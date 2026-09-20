"""Microsoft Graph v1.0 calendar adapter. OAuth code + PKCE, immutable event IDs."""
import base64
import hashlib
import json
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from uuid import UUID
from lib.integrations import store
from lib.integrations.security import owner_id

GRAPH = 'https://graph.microsoft.com/v1.0'
SCOPES = 'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite'


def configured():
    return store.configured() and all(os.getenv(k) for k in ('MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET'))


def authority():
    tenant = os.getenv('MICROSOFT_TENANT_ID','organizations')
    if not re.fullmatch(r'[A-Za-z0-9.-]+',tenant): raise ValueError('Invalid tenant.')
    return 'https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0'


def redirect_uri():
    return os.environ['NOCEAN_PUBLIC_ORIGIN'].rstrip('/')+'/api/outlook-callback'


def token_request(fields):
    fields = {**fields, 'client_id':os.environ['MICROSOFT_CLIENT_ID'],
              'client_secret':os.environ['MICROSOFT_CLIENT_SECRET'], 'scope':SCOPES}
    try:
        with urlopen(Request(authority()+'/token',data=urlencode(fields).encode()),timeout=12) as r:
            return json.load(r)
    except HTTPError as exc:
        raise RuntimeError('Microsoft authorization failed. Reconnect Outlook.') from exc


def graph(token, path, method='GET', payload=None, etag=None):
    url = path if path.startswith('https://') else GRAPH+path
    parsed = urlsplit(url)
    if parsed.scheme!='https' or parsed.netloc!='graph.microsoft.com' or not parsed.path.startswith('/v1.0/'):
        raise ValueError('Invalid Microsoft pagination URL.')
    headers={'Authorization':'Bearer '+token, 'Content-Type':'application/json',
             'Prefer':'IdType="ImmutableId", outlook.timezone="UTC"'}
    if etag: headers['If-Match']=etag
    try:
        with urlopen(Request(url,method=method,headers=headers,data=None if payload is None else json.dumps(payload).encode()),timeout=12) as r:
            return json.load(r)
    except HTTPError as exc:
        if exc.code==412: raise ValueError('This event changed in Outlook. Sync before editing again.') from exc
        raise RuntimeError('Microsoft request failed. Retry later or reconnect Outlook.') from exc


def begin_auth():
    if not configured(): raise RuntimeError('Microsoft connection setup is incomplete.')
    state=secrets.token_urlsafe(32); verifier=secrets.token_urlsafe(48)
    challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    with store.connection() as db:
        db.execute('DELETE FROM nocean.oauth_requests WHERE owner_id=%s AND expires_at<now()', (owner_id(),))
        db.execute("INSERT INTO nocean.oauth_requests VALUES (%s,%s,%s,now()+interval '10 minutes')",
                   (owner_id(),hashlib.sha256(state.encode()).hexdigest(),store.encrypt(verifier)))
    return authority()+'/authorize?'+urlencode({'client_id':os.environ['MICROSOFT_CLIENT_ID'],
        'response_type':'code','redirect_uri':redirect_uri(),'response_mode':'query','scope':SCOPES,
        'state':state,'code_challenge':challenge,'code_challenge_method':'S256','prompt':'select_account'})


def finish_auth(state, code):
    if not state or not code: raise ValueError('Microsoft sign-in was cancelled or incomplete.')
    with store.connection() as db:
        row=db.execute('DELETE FROM nocean.oauth_requests WHERE owner_id=%s AND state_hash=%s AND expires_at>now() RETURNING verifier_ciphertext',
                       (owner_id(),hashlib.sha256(state.encode()).hexdigest())).fetchone()
    if not row: raise PermissionError('Expired or reused Microsoft sign-in. Start again.')
    tokens=token_request({'grant_type':'authorization_code','code':code,'redirect_uri':redirect_uri(),
                          'code_verifier':store.decrypt(row['verifier_ciphertext'])})
    profile=graph(tokens['access_token'],'/me?$select=id,displayName')
    if not tokens.get('refresh_token'): raise RuntimeError('Microsoft did not grant offline access.')
    with store.connection() as db:
        store.lock(db,'outlook')
        store.save_account(db,'outlook',profile['id'],profile.get('displayName','Outlook'),tokens['refresh_token'])


def access(db):
    account=store.account(db,'outlook')
    if not account: raise ValueError('Connect Outlook first.')
    tokens=token_request({'grant_type':'refresh_token','refresh_token':store.decrypt(account['secret_ciphertext'])})
    if tokens.get('refresh_token'):
        db.execute('UPDATE nocean.provider_accounts SET secret_ciphertext=%s WHERE owner_id=%s AND provider=%s',
                   (store.encrypt(tokens['refresh_token']),owner_id(),'outlook'))
    return account,tokens['access_token']


def normalize(event, account_id):
    def at(key):
        v=event[key]['dateTime']
        if event.get('isAllDay'): return v[:10]
        # Every Graph request specifies UTC. Graph commonly omits the Z suffix.
        dt=datetime.fromisoformat(v.replace('Z','+00:00'))
        return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()
    return {'id':'outlook:'+account_id+':'+event['id'], 'externalId':event['id'],
        'name':event.get('subject') or 'Untitled event', 'at':at('start'), 'end':at('end'),
        'exclusiveEnd':True,'type':'Other','course':'','url':event.get('webLink',''),
        'etag':event.get('@odata.etag'), 'editable':not event.get('attendees') and event.get('type','singleInstance')=='singleInstance'}


def fetch_events(token, account_id, now=None):
    now=now or datetime.now(timezone.utc)
    path='/me/calendarView?'+urlencode({'startDateTime':(now-timedelta(days=62)).isoformat(),
        'endDateTime':(now+timedelta(days=180)).isoformat(),'$top':1000})
    events={}; seen=set(); started=time.monotonic()
    while path:
        if path in seen or len(seen)>=20 or time.monotonic()-started>30: raise RuntimeError('Microsoft calendar pagination exceeded the safe limit.')
        seen.add(path); data=graph(token,path)
        for event in data.get('value',[]):
            if event.get('isCancelled'):
                events.pop(event['id'],None)
            else: events[event['id']]=normalize(event,account_id)
        path=data.get('@odata.nextLink')
    return events


def sync():
    try:
        with store.connection() as db:
            store.lock(db,'outlook'); account,token=access(db)
            events=fetch_events(token,account['account_id'])
            # Only replace after ALL pages succeed; moved/deleted events cannot leave stale copies.
            db.execute('DELETE FROM nocean.provider_items WHERE owner_id=%s AND provider=%s',(owner_id(),'outlook'))
            for key,event in events.items(): store.put_item(db,'outlook',account['account_id'],key,event)
            store.synced(db,'outlook')
        return {'count':len(events)}
    except Exception:
        store.failed('outlook'); raise


def event_payload(data):
    if not isinstance(data.get('name'),str) or not 1<=len(data['name'].strip())<=300:
        raise ValueError('Use an event title of 1–300 characters.')
    dates=[]
    for key in ('at','end'):
        try: dt=datetime.fromisoformat(data[key].replace('Z','+00:00'))
        except (KeyError,ValueError,TypeError,AttributeError): raise ValueError('Start and end must include a time and timezone.')
        if dt.tzinfo is None: raise ValueError('Start and end must include a timezone.')
        dates.append(dt.astimezone(timezone.utc))
    if dates[1]<=dates[0]: raise ValueError('End must be after start.')
    return {'subject':data['name'].strip(), 'start':{'dateTime':dates[0].replace(tzinfo=None).isoformat(),'timeZone':'UTC'},
            'end':{'dateTime':dates[1].replace(tzinfo=None).isoformat(),'timeZone':'UTC'}}


def save_event(data, editing=False):
    payload=event_payload(data)
    if not editing:
        try: operation=str(UUID(data.get('operationId','')))
        except (ValueError,TypeError,AttributeError): raise ValueError('A stable request ID is required.')
        digest=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
        # Commit the request fingerprint BEFORE contacting Microsoft. An uncertain
        # network result can only be retried with the same key and same payload.
        with store.connection() as db:
            store.lock(db,'outlook')
            if not store.account(db,'outlook'): raise ValueError('Connect Outlook first.')
            prior=db.execute('SELECT request_hash FROM nocean.provider_operations WHERE owner_id=%s AND provider=%s AND operation_id=%s',
                             (owner_id(),'outlook',operation)).fetchone()
            if prior and prior['request_hash']!=digest: raise ValueError('This request ID was already used for different event details.')
            if not prior:
                db.execute('INSERT INTO nocean.provider_operations VALUES (%s,%s,%s,%s,NULL)',(owner_id(),'outlook',operation,digest))
    with store.connection() as db:
        store.lock(db,'outlook'); account,token=access(db)
        if editing:
            external=data.get('externalId')
            if not isinstance(external,str) or not external: raise ValueError('Select an event to edit.')
            known=db.execute('SELECT payload FROM nocean.provider_items WHERE owner_id=%s AND provider=%s AND external_id=%s',
                             (owner_id(),'outlook',external)).fetchone()
            if not known or not known['payload'].get('editable'): raise ValueError('Sync first; only individual events without attendees can be edited here.')
            etag=data.get('etag')
            if not etag or etag!=known['payload'].get('etag'): raise ValueError('Sync before editing this event.')
            # Refuse events that gained attendees since the cached snapshot.
            current=graph(token,'/me/events/'+quote(external,safe=''))
            if current.get('attendees') or current.get('type','singleInstance')!='singleInstance':
                raise ValueError('Edit meetings and recurring events directly in Outlook.')
            event=graph(token,'/me/events/'+quote(external,safe=''),'PATCH',payload,etag)
        else:
            try: operation=str(UUID(data.get('operationId','')))
            except (ValueError,TypeError,AttributeError): raise ValueError('A stable request ID is required.')
            digest=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
            prior=db.execute('SELECT request_hash,external_id FROM nocean.provider_operations WHERE owner_id=%s AND provider=%s AND operation_id=%s',
                             (owner_id(),'outlook',operation)).fetchone()
            if prior and prior['request_hash']!=digest: raise ValueError('This request ID was already used for different event details.')
            if prior and prior['external_id']:
                event=graph(token,'/me/events/'+quote(prior['external_id'],safe=''))
            else:
                # Graph transactionId prevents duplicate creation even after an uncertain response.
                event=graph(token,'/me/events','POST',{**payload,'transactionId':operation})
                db.execute('UPDATE nocean.provider_operations SET external_id=%s WHERE owner_id=%s AND provider=%s AND operation_id=%s',
                           (event['id'],owner_id(),'outlook',operation))
        normalized=normalize(event,account['account_id'])
        store.put_item(db,'outlook',account['account_id'],event['id'],normalized)
        return {'event':normalized}
