"""AthleticsProvider using the existing Daily log, Set log, and Exercises.

No schema changes, relation replacement, or habit writes. Sets are queried for
one day, not by reading the entire historic set log on every refresh.
"""
import math
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from uuid import UUID
from lib import notion

DAILY = os.getenv('NOTION_DAILY_DATA_SOURCE_ID', 'd534e9b3-624e-4ac3-bbdb-45f765039efc')
SETS = os.getenv('NOTION_SETS_DATA_SOURCE_ID', '08c9e7fc-304a-473c-b87c-327b331e2139')
EXERCISES = os.getenv('NOTION_EXERCISES_DATA_SOURCE_ID', '639eff57-714d-4be4-8a73-f2ebbf3ab090')
RHYTHM = ('Push', 'Pull', 'Legs', 'Rest', 'Push', 'Pull', 'Legs')
WORKOUT_TYPES = ('Push', 'Pull', 'Legs', 'Other')
QUALITIES = ('Not great', 'Productive', 'Great')
SUPPORT = {'rehab': 'Rehab', 'stretch': 'Stretch', 'cardio': 'Cardio', 'swim': 'Swim'}


def day_key(value):
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError('Use a date in YYYY-MM-DD format.')
    result = date.fromisoformat(value)
    if abs((result - datetime.now(notion.TZ).date()).days) > 366:
        raise ValueError('Choose a training date within one year.')
    return result


def number(value, name, minimum, maximum, integer=False):
    if type(value) not in (int, float) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError('Invalid ' + name + '.')
    if integer and int(value) != value:
        raise ValueError(name + ' must be a whole number.')
    return int(value) if integer else value


def own_page(id, source):
    try:
        id = str(UUID(str(id)))
    except (ValueError, TypeError):
        raise ValueError('Invalid record ID.')
    p = notion.request('GET', '/pages/' + id)
    if p.get('parent', {}).get('data_source_id', '').replace('-', '') != source.replace('-', ''):
        raise ValueError('Record is outside the training store.')
    if p.get('archived') or p.get('in_trash'):
        raise ValueError('Record was archived.')
    return p


def metric(page, name):
    v = notion.value(page, name)
    if isinstance(v, dict):
        v = v.get('number')
    return v if isinstance(v, (int, float)) else 0


def daily_summary(page):
    day = notion.local_day(notion.value(page, 'Date'))
    quality = notion.value(page, 'Workout Quality') or ''
    count = len(notion.value(page, 'Training sets') or [])
    return {'id':page['id'], 'date':day, 'workoutType':notion.value(page, 'Workout Type') or '',
            'quality':quality, 'completed':bool(quality), 'started':count > 0,
            'workingSets':metric(page, 'Working sets'), 'volume':metric(page, 'Training volume'),
            'support':{key:bool(notion.value(page, name)) for key,name in SUPPORT.items()}}


def exercise_summary(page):
    return {'id':page['id'], 'name':notion.value(page, 'Exercise') or 'Unnamed exercise',
            'active':bool(notion.value(page, 'Active')), 'rotation':bool(notion.value(page, 'Current rotation')),
            'mode':notion.value(page, 'Mode') or '', 'notes':notion.value(page, 'Setup notes') or ''}


def set_summary(page, exercise_names):
    relation = notion.value(page, 'Exercise') or []
    exercise = relation[0]['id'] if relation else ''
    return {'id':page['id'], 'exerciseId':exercise,
            'exercise':exercise_names.get(exercise) or notion.value(page, 'Source exercise') or notion.value(page, 'Set') or 'Exercise',
            'number':metric(page, 'Set number'), 'reps':notion.value(page, 'Reps'),
            'load':notion.value(page, 'Load lb'), 'externalLoad':bool(notion.value(page, 'External load')),
            'warmup':bool(notion.value(page, 'Warm-up')), 'completed':bool(notion.value(page, 'Completed')),
            'rir':notion.value(page, 'RIR')}


class NotionAthleticsProvider:
    def find_day(self, key):
        rows = notion.query(DAILY, {'property':'Date', 'date':{'equals':key}})
        if len(rows) > 1:
            raise ValueError('Duplicate daily logs found; no changes made.')
        return rows[0] if rows else None

    def save_day(self, key, props):
        page = self.find_day(key)
        props = {**props, 'Log':{'checkbox':True}}
        if page:
            return notion.request('PATCH', '/pages/' + page['id'], {'properties':props})
        return notion.request('POST', '/pages', {'parent':{'type':'data_source_id','data_source_id':DAILY},
            'properties':{'Day':{'title':[{'text':{'content':key}}]}, 'Date':{'date':{'start':key}}, **props}})

    def load(self, key):
        selected = day_key(key)
        monday = selected - timedelta(days=selected.weekday())
        start, end = (monday-timedelta(days=28)).isoformat(), (monday+timedelta(days=6)).isoformat()
        filter = {'and':[{'property':'Date','date':{'on_or_after':start}}, {'property':'Date','date':{'on_or_before':end}}]}
        with ThreadPoolExecutor(max_workers=2) as pool:
            daily_future = pool.submit(notion.query, DAILY, filter)
            exercise_future = pool.submit(notion.query, EXERCISES)
            pages = daily_future.result()
            # A missing exercise connection must still allow support work and daily completion.
            exercise_error = None
            try:
                exercises = [exercise_summary(p) for p in exercise_future.result()]
            except Exception:
                exercises = []; exercise_error = 'Exercise connection unavailable; set logging paused.'
        days = [daily_summary(p) for p in pages]
        by_date = {d['date']:d for d in days}
        current = by_date.get(key)
        names = {e['id']:e['name'] for e in exercises}
        sets, set_error = [], None
        if current:
            try:
                rows = notion.query(SETS, {'property':'Day','relation':{'contains':current['id']}})
                sets = [set_summary(p,names) for p in rows]
                sets.sort(key=lambda s:(s['exercise'],s['number'],s['id']))
            except Exception:
                set_error = 'Sets unavailable. Your workout and support work are still available.'
        week = []
        for offset, planned in enumerate(RHYTHM):
            d = (monday+timedelta(days=offset)).isoformat()
            summary = by_date.get(d, {'date':d,'completed':False,'started':False,'support':{k:False for k in SUPPORT},'workingSets':0,'volume':0,'quality':'','workoutType':''})
            week.append({**summary,'planned':planned})
        history = sorted([d for d in days if d['date'] < key and (d['started'] or d['completed'])],key=lambda d:d['date'],reverse=True)[:5]
        return {'date':key,'today':datetime.now(notion.TZ).date().isoformat(), 'week':week,
                'day':next(d for d in week if d['date']==key), 'sets':sets,
                'exercises':sorted(exercises,key=lambda e:(not e['rotation'],e['name'])), 'recent':history,
                'workoutTypes':list(WORKOUT_TYPES),'qualities':list(QUALITIES),
                'canLogSets':not bool(exercise_error or set_error), 'setMessage':exercise_error or set_error,
                'updatedAt':datetime.now(notion.TZ).isoformat()}

    def update_day(self, data):
        if set(data)-{'date','workoutType','quality','support'}:
            raise ValueError('Unknown training field.')
        key = day_key(data.get('date')).isoformat()
        props = {}
        for field, prop, allowed in [('workoutType','Workout Type',WORKOUT_TYPES),('quality','Workout Quality',QUALITIES)]:
            if field in data:
                v = data[field]
                if v not in ('',None) and v not in allowed:
                    raise ValueError('Invalid ' + field + '.')
                props[prop] = {'select':{'name':v} if v else None}
        if 'support' in data:
            if not isinstance(data['support'],dict) or set(data['support'])-set(SUPPORT):
                raise ValueError('Unknown support activity.')
            for field,value in data['support'].items():
                if type(value) is not bool:
                    raise ValueError('Support activity must be true or false.')
                props[SUPPORT[field]] = {'checkbox':value}
        if not props:
            raise ValueError('No training changes supplied.')
        return {'day':daily_summary(self.save_day(key,props))}

    def add_set(self, data):
        if set(data)-{'date','exerciseId','reps','load','externalLoad','warmup','rir','requestId'}:
            raise ValueError('Unknown set field.')
        key = day_key(data.get('date')).isoformat()
        reps = number(data.get('reps'),'reps',1,500,True)
        load = number(data.get('load'),'load',0,2000)
        rir = data.get('rir')
        if rir is not None: rir = number(rir,'RIR',0,20)
        for flag in ('externalLoad','warmup'):
            if type(data.get(flag)) is not bool: raise ValueError('Invalid ' + flag + '.')
        if not data['externalLoad'] and load != 0:
            raise ValueError('Bodyweight sets use zero external load.')
        try: request_id = str(UUID(str(data.get('requestId',''))))
        except ValueError: raise ValueError('Invalid save ID.')
        # The existing Source URL field provides retry deduplication without a new property.
        source = 'https://ocean-notion-widget.vercel.app/athletics.html#set-' + request_id
        existing = notion.query(SETS, {'property':'Source','url':{'equals':source}})
        exercise = own_page(data.get('exerciseId'), EXERCISES)
        names = {exercise['id']:notion.value(exercise,'Exercise') or 'Exercise'}
        if existing:
            return {'set':set_summary(existing[0],names)}
        day = self.find_day(key) or self.save_day(key,{})
        rows = notion.query(SETS, {'and':[{'property':'Day','relation':{'contains':day['id']}}, {'property':'Exercise','relation':{'contains':exercise['id']}}]})
        n = max((metric(p,'Set number') for p in rows),default=0)+1
        props = {'Set':{'title':[{'text':{'content':names[exercise['id']] + ' · Set ' + str(int(n))}}]},
                 'Day':{'relation':[{'id':day['id']}]}, 'Exercise':{'relation':[{'id':exercise['id']}]},
                 'Set number':{'number':n}, 'Reps':{'number':reps}, 'Load lb':{'number':load},
                 'External load':{'checkbox':data['externalLoad']}, 'Warm-up':{'checkbox':data['warmup']},
                 'Completed':{'checkbox':True}, 'RIR':{'number':rir}, 'Source':{'url':source}}
        result = notion.request('POST','/pages',{'parent':{'type':'data_source_id','data_source_id':SETS},'properties':props})
        return {'set':set_summary(result,names)}

    def archive_set(self, data):
        if set(data) != {'id'}: raise ValueError('Expected a set ID.')
        page = own_page(data['id'], SETS)
        notion.request('PATCH','/pages/'+page['id'],{'in_trash':True})
        return {'id':page['id'],'archived':True}
