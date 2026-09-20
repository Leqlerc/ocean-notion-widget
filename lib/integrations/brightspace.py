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
        course_match=re.search(r'\b([A-Z]{2,5})\s*(\d{3,5})\b',title)
        course=' '.join(course_match.groups()) if course_match else ''
        # Sequence wins over stale duplicate VEVENT entries with the same UID.
        sequence=int(event.get('SEQUENCE',0))
        record={'externalId':external,'sourceId':source_id,'name':title[:500],
                'course':course,'due':due.isoformat(),'url':url,'sequence':sequence}
        if external not in records or sequence>=records[external]['sequence']: records[external]=record
    return {'items':list(records.values()),'skipped':skipped,'completionAvailable':False}


def connect(url):
    url=validate_feed_url(url)
    preview=fetch_feed(url)  # Reject login HTML/invalid URL before saving any credential.
    with store.connection() as db:
        store.lock(db,'brightspace')
        store.save_account(db,'brightspace','purdue','Purdue Brightspace',url)
    return {'count':len(preview['items']),'skipped':preview['skipped']}


def source_matches(record):
    # Persist a recovery marker in Notion in the SAME create request as the task.
    # A SQL commit/network failure cannot make a retry create another task.
    filters=[{'property':'Source ID','rich_text':{'equals':record['sourceId']}},
             {'property':'Source ID','rich_text':{'equals':record['externalId']}}]
    if '/calendar/6824' not in record['url']:
        filters.append({'property':'Source','url':{'equals':record['url']}})
    matches=notion.query(notion.TASKS,{'or':filters})
    if len(matches)>1: raise ValueError('Multiple tasks match this Brightspace item. Reconcile before sync.')
    return matches


def sync_task(record, local_id=None, allow_create=True):
    tasks=NotionTaskStore()
    if local_id:
        try: page=tasks.owned_page({'id':local_id})
        except ValueError:
            # Respect user archive. Never recreate an explicitly archived imported task.
            return local_id,'archived'
    else:
        matches=source_matches(record)
        page=matches[0] if matches else None

    properties=tasks.properties({'name':record['name'],'due':record['due'],**({'course':record['course']} if record['course'] else {})})
    properties.update({'Source ID':{'rich_text':[{'text':{'content':record['sourceId']}}]},
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
        result={'created':0,'updated':0,'archived':0,'unchanged':0,'remaining':0,'skipped':feed['skipped']}
        processed=0
        for record in feed['items']:
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
                local,action=sync_task(record,old['local_id'] if old else (previous['external_id'] if previous else None),allow_create=allow_create)
                store.put_item(db,'brightspace',account['account_id'],record['externalId'],record,local)
                db.execute('UPDATE nocean.provider_operations SET external_id=%s WHERE owner_id=%s AND provider=%s AND operation_id=%s',(local,owner_id(),'brightspace',operation))
                result[action]+=1; processed+=1
        with store.connection() as db:
            if result['remaining']==0: store.synced(db,'brightspace')
        return result
    except Exception:
        store.failed('brightspace'); raise
