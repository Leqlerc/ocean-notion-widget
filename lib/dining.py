"""Official HFS v2 provider; missing nutrition stays missing, never zero-filled."""
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from urllib.request import Request, urlopen
from lib.notion import TZ

BASE = 'https://api.hfs.purdue.edu/menus/v2'
COURTS = ('Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor')
_CACHE = {}
EXCLUDE = re.compile(r'\b(sauce|dressing|ketchup|mustard|mayonnaise|syrup|gravy|cookie|cake|brownie|dessert|ice cream|ice|juice|soda|coffee|tea|lemonade|sugar|condiment|muffin|donut|doughnut|pastry|beverage|butter|bun|bread|topping|shredded cheese)\b', re.I)
PROTEIN = re.compile(r'\b(chicken|turkey|beef|pork|steak|fish|salmon|tuna|tilapia|cod|shrimp|tofu|tempeh|seitan|egg|eggs|omelet|omelette|burger|lentil|lentils|beans|edamame|yogurt|cottage cheese|ham|sausage|meatball|meatballs|brisket|falafel)\b', re.I)


def fetch(path, ttl=300):
    now = time.monotonic()
    cached = _CACHE.get(path)
    if cached and cached[0] > now:
        return cached[1]
    with urlopen(Request(BASE + path, headers={'Accept': 'application/json', 'User-Agent': 'NOcean/2.0'}), timeout=6) as r:
        data = json.load(r)
    if len(_CACHE) > 600:
        _CACHE.clear()
    _CACHE[path] = (now + ttl, data)
    return data


def nutrition(item):
    result = {'protein': None, 'fat': None, 'sodium': None, 'serving': None}
    if not item.get('NutritionReady'):
        return result
    try:
        details = fetch('/items/' + item['ID'], 86400)
        for row in details.get('Nutrition', []):
            name = row.get('Name', '').lower()
            if name == 'serving size':
                result['serving'] = row.get('LabelValue')
            field = {'protein': 'protein', 'total fat': 'fat', 'sodium': 'sodium'}.get(name)
            v = row.get('Value')
            if field and isinstance(v, (float, int)) and v >= 0:
                result[field] = round(v, 1)
    except Exception:
        pass
    return result


def rank_macro_picks(items, limit=1):
    """Protein first; within each 5g protein band prefer less fat, then sodium.

    Scores are per HFS serving. Unknown macros sort after measured choices.
    A minimum 10g protein removes trivial sides; unmeasured protein entrees
    may fill remaining slots, explicitly marked as nutrition unavailable.
    """
    eligible = [i for i in items if not EXCLUDE.search(i['name']) and
                ((i['protein'] is not None and i['protein'] >= 10) or
                 (i['protein'] is None and PROTEIN.search(i['name'])))]
    def score(i):
        if i['protein'] is None:
            return (1, 0, float('inf'), float('inf'), i['name'])
        return (0, -(i['protein'] // 5), i['fat'] if i['fat'] is not None else float('inf'),
                i['sodium'] if i['sodium'] is not None else float('inf'), i['name'])
    return sorted(eligible, key=score)[:limit]


def meal_window(meal, day):
    hours = meal.get('Hours') or {}
    if meal.get('Status') != 'Open' or not hours.get('StartTime') or not hours.get('EndTime'):
        return None
    try:
        start = datetime.fromisoformat(day + 'T' + hours['StartTime']).replace(tzinfo=TZ)
        end = datetime.fromisoformat(day + 'T' + hours['EndTime']).replace(tzinfo=TZ)
        if end <= start:
            end += timedelta(days=1)
        return start, end
    except ValueError:
        return None


def court_menu(name, now):
    day = now.date()
    for offset in (0, 1):
        menu_day = day + timedelta(days=offset)
        data = fetch('/locations/' + name + '/' + menu_day.strftime('%m-%d-%Y'))
        if not data.get('IsPublished'):
            if offset == 0:
                return {'name': name, 'open': None, 'message': 'Menu not published', 'picks': []}, []
            continue
        meals = [(m, meal_window(m, menu_day.isoformat())) for m in data.get('Meals', [])]
        meals = sorted([(m, w) for m, w in meals if w and w[1] > now], key=lambda x: x[1][0])
        if not meals:
            continue
        meal, (start, end) = meals[0]
        items = {}
        for station in meal.get('Stations', []):
            if re.search(r'pastry|dessert|beverage', station.get('Name', ''), re.I):
                continue
            for item in station.get('Items', []):
                name_ = item.get('Name', '')
                if item.get('ID') and not EXCLUDE.search(name_):
                    items[item['ID']] = item
        return {'name': name, 'open': start <= now < end, 'meal': meal.get('Name', ''),
                'start': start.isoformat(), 'end': end.isoformat(), 'picks': [],
                'date': menu_day.isoformat()}, list(items.values())
    return {'name': name, 'open': False, 'message': 'No upcoming meal published', 'picks': []}, []


def load_dining():
    now = datetime.now(TZ)
    def safe_court(name):
        try:
            return court_menu(name, now)
        except Exception:
            return {'name': name, 'open': None, 'message': 'Dining data unavailable', 'picks': []}, []
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(safe_court, COURTS))
    unique = {i['ID']: i for _, items in results for i in items}
    # Fetch each unique item once, even if several courts serve it.
    with ThreadPoolExecutor(max_workers=12) as pool:
        values = list(pool.map(nutrition, unique.values()))
    nutrients = dict(zip(unique, values))
    courts = []
    for court, items in results:
        normalized = [{'id': i['ID'], 'name': i['Name'], **nutrients[i['ID']]} for i in items]
        court['picks'] = rank_macro_picks(normalized)
        if not court['picks'] and not court.get('message'):
            court['message'] = 'No qualifying protein picks in this menu'
        courts.append(court)
    return {'courts': courts, 'updatedAt': now.isoformat(), 'source': 'Purdue HFS',
            'ranking': 'Protein first; similar-protein choices ranked by fat, then sodium. Per listed serving.'}
