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
EXCLUDE = re.compile(r'\b(dip|green beans|wax beans|bean sprouts|sauce|dressing|ketchup|mustard|mayonnaise|syrup|gravy|cookie|cake|brownie|dessert|ice cream|ice|juice|soda|coffee|tea|lemonade|sugar|condiment|muffin|donut|doughnut|pastry|beverage|butter|bun|bread|topping|shredded cheese)\b', re.I)
PROTEIN = re.compile(r'\b(chicken|turkey|beef|pork|steak|fish|salmon|tuna|tilapia|cod|shrimp|tofu|tempeh|seitan|egg|eggs|omelet|omelette|burger|lentil|lentils|beans|edamame|yogurt|cottage cheese|ham|sausage|meatball|meatballs|brisket|falafel)\b', re.I)
# Permanent/repetitive items are intentionally deprioritized so the card tells the user
# what is unusually worth eating in the current meal, not the same staple every day.
STAPLE = re.compile(r'\b(grilled chicken breast|hamburger|cheeseburger|hot dog|pizza|deli turkey|deli ham|scrambled eggs|hard[- ]boiled eggs|waffle|french fries|tater tots)\b', re.I)
HARD_EXCLUDE = re.compile(r'\bgarlic chicken strips?\b', re.I)


def fetch(path, ttl=300):
    now = time.monotonic()
    cached = _CACHE.get(path)
    if cached and cached[0] > now:
        return cached[1]
    with urlopen(Request(path if path.startswith('https://') else BASE + path, headers={'Accept': 'application/json', 'User-Agent': 'NOcean/2.0'}), timeout=10) as r:
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


def rank_macro_picks(items, limit=3):
    """Measured rotating entrees first, then protein per serving and protein/fat."""
    eligible=[i for i in items if not EXCLUDE.search(i['name']) and not HARD_EXCLUDE.search(i['name'])
              and PROTEIN.search(i['name']) and (i['protein'] is None or i['protein']>=15)]
    return sorted(eligible,key=protein_score)[:limit]


def protein_score(i):
    rotating=i.get('rotating',not bool(STAPLE.search(i['name'])))
    protein=i['protein'];fat=i['fat']
    return (protein is None,not rotating,-(protein or 0),-(protein/max(fat,1) if protein is not None and fat is not None else 0),i['name'])


def hall_score(court):
    # No recommendations belong last; stable hall name breaks equal food scores.
    picks=court.get('picks') or []
    return (not bool(picks), protein_score(picks[0])[:-1] if picks else (), court['name'])



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


def meal_group(meal):
    name=(meal.get('Type') or meal.get('Name','')).lower()
    if 'breakfast' in name: return None
    if 'lunch' in name or name=='brunch': return 'Lunch'
    if 'dinner' in name: return 'Dinner'
    return None


def court_menu(name, now):
    day=now.date().isoformat()
    data=fetch('/locations/'+name+'/'+now.strftime('%m-%d-%Y'))
    views={}
    for group in ('Lunch','Dinner'):
        candidates=[(m,meal_window(m,day)) for m in data.get('Meals',[]) if meal_group(m)==group]
        candidates=[(m,w) for m,w in candidates if w]
        # Late Lunch belongs to Lunch, but never blend two different serving windows.
        candidates.sort(key=lambda pair:(0 if pair[1][0]<=now<pair[1][1] else 1 if now<pair[1][0] else 2,pair[1][0]))
        info={'name':name,'meal':group,'date':day,'open':False,'picks':[]}
        if not data.get('IsPublished') or not candidates:
            info['message']='Menu not published' if not data.get('IsPublished') else 'No '+group.lower()+' service published'
            views[group]=(info,[]);continue
        meal,(start,end)=candidates[0]
        info.update(open=start<=now<end,start=start.isoformat(),end=end.isoformat(),service=meal['Name'])
        items={}
        for station in meal.get('Stations',[]):
            station_name=station.get('Name','')
            if re.search(r'pastry|dessert|beverage|sugar hill',station_name,re.I):continue
            for item in station.get('Items',[]):
                label=item.get('Name','')
                if item.get('ID') and PROTEIN.search(label) and not EXCLUDE.search(label) and not HARD_EXCLUDE.search(label):
                    items[item['ID']]={**item,'station':station_name,'rotating':not bool(STAPLE.search(label) or re.search(r'deli|salami|pizza|salad|by request',station_name,re.I))}
        views[group]=(info,list(items.values()))
    return views


WAIT_LEVELS=((5,'low','Low'),(10,'moderate','Moderate'),(20,'busy','Busy'),(float('inf'),'very-busy','Very busy'))
WAITZ_LEVELS={'not-busy':('low','Low'),'busy':('busy','Busy'),'very-busy':('very-busy','Very busy')}

def wait_report(report,now):
    try:
        updated=datetime.fromisoformat(report['LastUpdated'].replace('Z','+00:00'))
        if not updated.tzinfo:updated=updated.replace(tzinfo=TZ)
        if not -60<=(now-updated).total_seconds()<=900:return None
        text=report['ShortLoadDescription']
        match=re.search(r'(\d+)(?:\s*[-–]\s*(\d+))?\s*min',text,re.I)
        if not match:return None
        low=int(match[1]);high=int(match[2] or match[1])
        if high<low or high>180:return None
        level,label=next((level,label) for maximum,level,label in WAIT_LEVELS if high<=maximum)
        return {'level':level,'label':label,'estimate':str(low)+('–'+str(high) if high!=low else '')+' min','updatedAt':updated.isoformat(),'source':'Purdue Mobile Menus'}
    except (KeyError,TypeError,ValueError):return None


def load_crowds(now):
    def safe(path):
        try:return fetch(path,90)
        except Exception:return {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        live,official=list(pool.map(safe,['https://waitz.io/live/purdue','/lineLength/all']))
    rows=next((r.get('subLocs') or [] for r in live.get('data',[]) if r.get('name')=='Dining'),[])
    waits={r.get('LocationName'):wait_report(r,now) for r in official.get('LineLengthReport',[])}
    result={}
    for name in COURTS:
        row=next((r for r in rows if r.get('name')==name),None);wait=waits.get(name)
        item={'available':False,'level':'unknown','label':'Crowd unavailable','source':None,'estimate':None,'checkedAt':now.isoformat()}
        if row and row.get('isAvailable'):
            category=(row.get('subLocHtml') or {}).get('class')
            if not row.get('isOpen'):item.update(available=True,level='closed',label='Closed now',source='Waitz')
            elif category in WAITZ_LEVELS:
                level,label=WAITZ_LEVELS[category];item.update(available=True,level=level,label=label,source='Waitz')
                if isinstance(row.get('percentage'),(int,float)):item['percent']=round(row['percentage']*100)
        if wait and item['level']!='closed':
            if not item['available']:item.update(available=True,level=wait['level'],label=wait['label'],source=wait['source'])
            item.update(estimate=wait['estimate'],waitUpdatedAt=wait['updatedAt'],waitSource=wait['source'])
        result[name]=item
    return result


def load_dining():
    now=datetime.now(TZ)
    def safe_court(name):
        try:return court_menu(name,now)
        except Exception:return {meal:({'name':name,'meal':meal,'open':None,'date':now.date().isoformat(),'message':'Menu unavailable','picks':[]},[]) for meal in ('Lunch','Dinner')}
    with ThreadPoolExecutor(max_workers=6) as pool:
        crowd_job=pool.submit(load_crowds,now)
        results=list(pool.map(safe_court,COURTS));crowds=crowd_job.result()
    unique={i['ID']:i for views in results for _,items in views.values() for i in items}
    with ThreadPoolExecutor(max_workers=16) as pool:values=list(pool.map(nutrition,unique.values()))
    nutrients=dict(zip(unique,values));meals={'Lunch':[],'Dinner':[]}
    for views in results:
        for group,(court,items) in views.items():
            normalized=[{'id':i['ID'],'name':i['Name'],'station':i['station'],'rotating':i['rotating'],**nutrients[i['ID']]} for i in items]
            court['picks']=rank_macro_picks(normalized);court['crowd']=crowds[court['name']]
            if not court['picks'] and not court.get('message'):court['message']='No qualifying protein entrees published'
            meals[group].append(court)
    for courts in meals.values():courts.sort(key=hall_score)
    return {'meals':meals,'courts':meals['Lunch' if now.hour<15 else 'Dinner'],'date':now.date().isoformat(),'updatedAt':now.isoformat(),
            'source':'Purdue Mobile Menus','crowdSource':'Waitz; Purdue Mobile Menus wait estimates when fresh',
            'ranking':'Rotating entrees first; higher protein, then protein-to-fat efficiency per serving. Rotating inferred from station and staple exclusions.'}
