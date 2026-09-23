"""Authorized Brightspace iCalendar feeds -> existing Notion Tasks.

Feeds expose dates, not submission/completion state. Never infer completion or
remove tasks because a rolling feed omits them. Recurring classes are skipped.
"""
import hashlib
import re
import time as clock
from datetime import date, datetime, time
from uuid import uuid5, NAMESPACE_URL
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from lib import notion
from lib.tasks import NotionTaskStore, normalize
from lib.integrations import store
from lib.integrations.security import owner_id
from lib.integrations.coursework import course_for, identity, actionable, canonical_rank, title_key, compatible, org_unit, ORG_COURSES


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError('Brightspace feed redirected. Copy the direct calendar subscription URL.')


def validate_feed_url(url):
    if not isinstance(url,str): raise ValueError('A Brightspace calendar feed URL is required.')
    url=url.strip().replace('webcal://','https://',1)
    parts=urlsplit(url)
    if parts.scheme!='https' or parts.netloc!='purdue.brightspace.com' or not parts.path.startswith('/d2l/') or parts.fragment:
        raise ValueError('Use the HTTPS calendar feed provided by purdue.brightspace.com.')
    return url


def fetch_feed(url):
    url=validate_feed_url(url)
    with build_opener(NoRedirect).open(Request(url,headers={'Accept':'text/calendar'}),timeout=12) as r:
        body=r.read(2_000_001)
    if len(body)>2_000_000: raise ValueError('Calendar feed exceeds 2 MB.')
    return parse_feed(body)


def parse_feed(body):
    from icalendar import Calendar
    if b'BEGIN:VCALENDAR' not in body[:1000]: raise ValueError('The URL did not return a calendar feed.')
    calendar=Calendar.from_ical(body)
    records={}; skipped=0
    for event in calendar.walk('VEVENT'):
        uid=str(event.get('UID','')).strip()
        if not uid or event.get('RRULE') or str(event.get('STATUS','')).upper()=='CANCELLED':
            skipped+=1; continue
        due=event.get('DUE') or event.get('DTSTART')
        if due is None: skipped+=1; continue
        due=due.dt
        if not isinstance(due,(date,datetime)): skipped+=1; continue
        if not isinstance(due,datetime): due=datetime.combine(due,time(23,59),notion.TZ)
        if due.tzinfo is None: due=due.replace(tzinfo=notion.TZ)
        title=str(event.get('SUMMARY','')).strip()
        if not title: skipped+=1; continue
        recurrence=event.get('RECURRENCE-ID')
        external=uid+('::'+recurrence.dt.isoformat() if recurrence else '')
        source_id='brightspace:'+hashlib.sha256(external.encode()).hexdigest()
        url=str(event.get('URL',''))
        if urlsplit(url).scheme!='https' or urlsplit(url).netloc!='purdue.brightspace.com':
            description=str(event.get('DESCRIPTION',''))
            match=re.search(r'https://purdue\.brightspace\.com/[^\s<>"\]]+',description)
            url=match.group(0) if match else 'https://purdue.brightspace.com/d2l/le/calendar/6824'
        course=course_for(title,url,str(event.get('X-COURSE','')))
        # Sequence wins over stale duplicate VEVENT entries with the same UID.
        sequence=int(event.get('SEQUENCE',0))
        record={'externalId':external,'sourceId':source_id,'name':title[:500],
                'course':course,'due':due.isoformat(),'url':url,'sequence':sequence}
        if external not in records or sequence>=records[external]['sequence']: records[external]=record
    filtered=actionable(list(records.values()))
    skipped+=len(records)-len(filtered)
    groups={}
    for record in filtered:
        key=identity(record) or record['externalId']
        if key in groups:
            groups[key].setdefault('aliases',[]).append(record['externalId'])
            skipped+=1
        else: groups[key]=record
    return {'items':list(groups.values()),'skipped':skipped,'completionAvailable':False}


def connect(url):
    url=validate_feed_url(url)
    preview=fetch_feed(url)  # Reject login HTML/invalid URL before saving any credential.
    with store.connection() as db:
        store.lock(db,'brightspace')
        store.save_account(db,'brightspace','purdue','Purdue Brightspace',url)
    return {'count':len(preview['items']),'skipped':preview['skipped']}


def task_key(name,due):
    # Conservative manual-task dedupe: same local due day + same title after
    # punctuation/spacing normalization, with an optional leading course code removed.
    return (notion.local_day(due),title_key(name))


def existing_match(record,pages):
    normalized=[(page,normalize(page)) for page in pages]
    exact=[(page,item) for page,item in normalized if identity(record) and identity(record)==identity(item)]
    if exact:
        exact.sort(key=lambda pair:canonical_rank(pair[1]))
        if all(compatible(exact[0][1],item) for _,item in exact[1:]): return exact[0][0]
        raise ValueError('Conflicting user state on duplicate coursework. Reconcile before sync.')
    source=[page for page,item in normalized if item.get('sourceId') in (record['sourceId'],record['externalId'])]
    if len(source)>1: raise ValueError('Multiple tasks match this Brightspace source marker.')
    if source: return source[0]

    return None


def source_matches(record):
    # Persist a recovery marker in Notion in the SAME create request as the task.
    # A SQL commit/network failure cannot make a retry create another task.
    filters=[{'property':'Source ID','rich_text':{'equals':record['sourceId']}},
             {'property':'Source ID','rich_text':{'equals':record['externalId']}}]
    matches=notion.query(notion.TASKS,{'or':filters})
    if len(matches)>1: raise ValueError('Multiple tasks match this Brightspace item. Reconcile before sync.')
    return matches


def sync_task(record, local_id=None, allow_create=True, existing_pages=None):
    tasks=NotionTaskStore()
    if local_id:
        try: page=tasks.owned_page({'id':local_id})
        except ValueError:
            # Respect user archive. Never recreate an explicitly archived imported task.
            return local_id,'archived'
        if existing_pages is not None:
            canonical=existing_match(record,existing_pages)
            if canonical: page=canonical
    else:
        if existing_pages is not None:
            page=existing_match(record,existing_pages)
        else:
            matches=source_matches(record)
            page=matches[0] if matches else None

    existing=normalize(page) if page else {}
    properties=tasks.properties({**({} if page else {'name':record['name']}),'due':record['due'],**({'course':record['course']} if record['course'] and (not existing.get('course') or org_unit(record['url']) in ORG_COURSES) else {})})
    properties.update({'Source ID':{'rich_text':[{'text':{'content':existing.get('sourceId') or record['sourceId']}}]},
                       'Source':{'url':record['url']}})
    if page:
        # Keep completion, planning, focus, project, difficulty and all user-owned fields.
        result=notion.request('PATCH','/pages/'+page['id'],{'properties':properties})
        return result['id'],'updated'
    if not allow_create:
        raise ValueError('A previous Brightspace create has an uncertain result. Retry after Notion catches up; if still missing, reconcile its source marker before clearing the pending operation.')
    properties.update(tasks.properties({'status':'inbox','focus':False,'planningMode':'automatic'}))
    result=notion.request('POST','/pages',{'parent':{'type':'data_source_id','data_source_id':notion.TASKS},'properties':properties})
    return result['id'],'created'


def sync(limit=8):
    started=clock.monotonic()
    try:
        with store.connection() as db:
            account=store.account(db,'brightspace')
            if not account: raise ValueError('Connect the Brightspace feed first.')
            feed=fetch_feed(store.decrypt(account['secret_ciphertext']))
        now=datetime.now(notion.TZ)
        upcoming=[]
        past=0
        for record in feed['items']:
            due=datetime.fromisoformat(record['due'].replace('Z','+00:00'))
            if due.tzinfo is None:
                due=due.replace(tzinfo=notion.TZ)
            if due<now:
                past+=1
            else:
                upcoming.append(record)
        upcoming.sort(key=lambda record: record['due'])
        existing_pages=notion.query(notion.TASKS)
        result={'created':0,'updated':0,'archived':0,'unchanged':0,'remaining':0,
                'skipped':feed['skipped'],'skippedPast':past}
        processed=0
        for record in upcoming:
            operation=str(uuid5(NAMESPACE_URL,record['sourceId']))
            allow_create=False
            # Durable reservation survives a timeout after Notion accepted a create.
            # An uncertain retry may adopt its source marker, but never create blindly.
            with store.connection() as db:
                store.lock(db,'brightspace')
                previous=db.execute('SELECT external_id FROM nocean.provider_operations WHERE owner_id=%s AND provider=%s AND operation_id=%s',
                                    (owner_id(),'brightspace',operation)).fetchone()
                if not previous and processed<limit and clock.monotonic()-started<=18:
                    db.execute('INSERT INTO nocean.provider_operations VALUES (%s,%s,%s,%s,NULL)',
                               (owner_id(),'brightspace',operation,record['sourceId']))
                    allow_create=True
            with store.connection() as db:
                store.lock(db,'brightspace')
                old=db.execute('SELECT local_id,payload FROM nocean.provider_items WHERE owner_id=%s AND provider=%s AND external_id=%s',
                               (owner_id(),'brightspace',record['externalId'])).fetchone()
                if old and old['payload']==record:
                    result['unchanged']+=1; continue
                if processed>=limit or (clock.monotonic()-started>18 and not allow_create):
                    result['remaining']+=1; continue
                local,action=sync_task(record,old['local_id'] if old else (previous['external_id'] if previous else None),
                                       allow_create=allow_create,existing_pages=existing_pages)
                store.put_item(db,'brightspace',account['account_id'],record['externalId'],record,local)
                for alias in record.get('aliases',[]):
                    store.put_item(db,'brightspace',account['account_id'],alias,record,local)
                db.execute('UPDATE nocean.provider_operations SET external_id=%s WHERE owner_id=%s AND provider=%s AND operation_id=%s',(local,owner_id(),'brightspace',operation))
                result[action]+=1; processed+=1
                # Include the accepted create in this run's recovery snapshot.
                if action=='created': existing_pages.append(tasks_page(local,record))
        with store.connection() as db:
            store.sync_progress(db,'brightspace',result)
            if result['remaining']==0: store.synced(db,'brightspace')
        return result
    except Exception:
        store.failed('brightspace'); raise


def tasks_page(local,record):
    properties=NotionTaskStore().properties({'name':record['name'],'course':record['course'],'due':record['due']})
    # normalize() expects the Notion response's typed properties and plain_text.
    for prop in properties.values():
        kind=next(iter(prop));prop['type']=kind
        if kind=='title':
            for text in prop[kind]: text['plain_text']=text['text']['content']
    properties['Source ID']={'type':'rich_text','rich_text':[{'plain_text':record['sourceId']}]}
    return {'id':local,'properties':properties}
