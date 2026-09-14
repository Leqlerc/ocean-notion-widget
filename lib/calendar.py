"""CalendarProvider boundary. Google and Notion contribute independently."""
import json
import os
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from lib import notion


class NotionCalendarProvider:
    def load(self):
        events = []
        for p in notion.query(notion.EVENTS):
            at = notion.value(p, 'Date')
            if not at:
                continue
            events.append({'id': p['id'], 'name': notion.value(p, 'Event') or 'Untitled event',
                'at': at, 'end': (p['properties']['Date'].get('date') or {}).get('end'),
                'type': notion.value(p, 'Event Type') or 'Other',
                'course': notion.value(p, 'Course') or '',
                'url': notion.value(p, 'Source') or p.get('url', '')})
        return {'events': events, 'source': 'Fallback synced events · updates may be delayed', 'direct': False}


class DirectGoogleCalendarProvider:
    _token = None
    _expires_at = 0

    def access_token(self):
        if self._token and time.monotonic() < self._expires_at:
            return self._token
        payload = urlencode({'client_id': os.environ['GOOGLE_CLIENT_ID'],
            'client_secret': os.environ['GOOGLE_CLIENT_SECRET'],
            'refresh_token': os.environ['GOOGLE_REFRESH_TOKEN'], 'grant_type': 'refresh_token'}).encode()
        with urlopen(Request('https://oauth2.googleapis.com/token', data=payload), timeout=10) as r:
            data = json.load(r)
        type(self)._token = data['access_token']
        type(self)._expires_at = time.monotonic() + max(0, float(data.get('expires_in', 3600))-60)
        return self._token

    def load(self):
        token = self.access_token()
        now = datetime.now(timezone.utc)
        events = []
        calendars = list(dict.fromkeys(c.strip() for c in os.getenv('GOOGLE_CALENDAR_IDS', 'primary').split(',') if c.strip())) or ['primary']
        for calendar in calendars:
            page = None
            while True:
                params = {'singleEvents': 'true', 'orderBy': 'startTime', 'maxResults': 2500,
                    'timeMin': (now - timedelta(days=62)).isoformat(),
                    'timeMax': (now + timedelta(days=180)).isoformat()}
                if page:
                    params['pageToken'] = page
                url = 'https://www.googleapis.com/calendar/v3/calendars/' + quote(calendar.strip(), safe='') + '/events?' + urlencode(params)
                with urlopen(Request(url, headers={'Authorization': 'Bearer ' + token}), timeout=15) as r:
                    data = json.load(r)
                for e in data.get('items', []):
                    if e.get('status') == 'cancelled':
                        continue
                    start, end = e.get('start', {}), e.get('end', {})
                    if not (start.get('dateTime') or start.get('date')):
                        continue
                    name = e.get('summary', 'Event')
                    routine = e.get('recurringEventId') and re.search(r'\b[A-Z]{2,5}\s*\d{3,5}\b', name) and not re.search(r'exam|quiz|cfu|practical|presentation|demonstration|break', name, re.I)
                    events.append({'id': calendar + ':' + e['id'], 'name': e.get('summary', 'Event'),
                        'at': start.get('dateTime') or start.get('date'),
                        'end': end.get('dateTime') or end.get('date'),
                        'exclusiveEnd': True, 'type': 'Class' if routine else 'Other', 'course': '', 'url': e.get('htmlLink', '')})
                page = data.get('nextPageToken')
                if not page:
                    break
        return {'events': events, 'source': 'Direct Google Calendar', 'direct': True}


def event_instant(value):
    """Sort date-only events at campus midnight; retain original strings in output."""
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return (dt if dt.tzinfo else dt.replace(tzinfo=notion.TZ)).timestamp()


def title_key(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def same_event(a, b):
    # Never collapse two events within one provider or conflate date-only with timed events.
    if b['source'] in a.get('sources',[a['source']]) or title_key(a['name']) != title_key(b['name']):
        return False
    if (len(a['at']) == 10) != (len(b['at']) == 10) or event_instant(a['at']) != event_instant(b['at']):
        return False
    if a.get('end') and b.get('end'):
        def end_instant(e):
            end = event_instant(e['end'])
            # Notion date ranges include the last day; Google all-day ends are exclusive.
            if len(e['end']) == 10 and not e.get('exclusiveEnd'):
                end = event_instant((datetime.fromisoformat(e['end']) + timedelta(days=1)).date().isoformat())
            return end
        if end_instant(a) != end_instant(b):
            return False
    return True


def merge_events(batches):
    merged = []
    for source in ('google', 'notion'):
        for item in batches.get(source, []):
            try:
                event_instant(item['at'])
            except (KeyError, ValueError, TypeError):
                continue
            event = {**item, 'source':source, 'sources':[source], 'sourceIds':{source:item['id']}}
            duplicate = next((e for e in merged if same_event(e,event)), None)
            if duplicate:
                duplicate['sources'].append(source)
                duplicate['sourceIds'][source] = item['id']
                if duplicate.get('type') in ('Other','Class','') and item.get('type') not in ('Other','Class','',None):
                    duplicate['type'] = item['type']
                duplicate['course'] = duplicate.get('course') or item.get('course','')
            else:
                merged.append(event)
    return sorted(merged, key=lambda e:(event_instant(e['at']),title_key(e['name']),e['id']))


def load_calendar():
    required = ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN')
    missing = [key for key in required if not os.getenv(key, '').strip()]
    providers = {'notion':NotionCalendarProvider()}
    if not missing:
        providers['google'] = DirectGoogleCalendarProvider()
    batches, status = {}, {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {key:pool.submit(provider.load) for key,provider in providers.items()}
        for key,job in jobs.items():
            try:
                batches[key] = job.result()['events']
                status[key] = {'available':True,'count':len(batches[key])}
            except Exception:
                status[key] = {'available':False,'count':0,'error':key.title()+' events unavailable'}
    if not batches:
        raise RuntimeError('All calendar sources unavailable.')
    direct = 'google' in batches
    source = 'Direct Google Calendar + Notion events' if direct and 'notion' in batches else 'Direct Google Calendar' if direct else 'Notion events'
    warnings = [v['error'] for v in status.values() if not v['available']]
    if missing:
        status['google'] = {'available':False,'count':0,'error':'Direct Google is not configured'}
        source += ' · Google not configured'
    elif not direct:
        source += ' · Google unavailable'
    elif 'notion' not in batches:
        source += ' · Notion unavailable'
    return {'events':merge_events(batches), 'source':source, 'direct':direct,
            'providers':status, 'warnings':warnings, 'configurationMissing':missing,
            'updatedAt':datetime.now(timezone.utc).isoformat()}
