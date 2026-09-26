"""Home calendar: live Google plus explicitly sourced independent coursework."""
import json
import os
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote, urlsplit, parse_qs
from urllib.request import Request, urlopen
from lib import notion


class NotionCalendarProvider:
    def load(self, independent_only=False):
        events = []
        for p in notion.query(notion.EVENTS):
            at = notion.value(p, 'Date')
            if not at:
                continue
            source = notion.value(p, 'Source') or ''
            # Existing independent academic entries link to their Purdue source.
            # Missing links and Google mirrors are never a Home fallback, even on outage.
            parsed = urlsplit(source)
            if independent_only and not (parsed.scheme == 'https' and
                    (parsed.hostname in ('purdue.edu', 'purdue.brightspace.com') or (parsed.hostname or '').endswith('.purdue.edu'))):
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

    def calendar_ids(self, token):
        # Known NOcean calendars, recovered from existing Google source links.
        # IDs are identifiers, not credentials. Explicit configuration remains authoritative.
        # Reading event collections works without the additional CalendarList scope.
        defaults = ','.join([
            'primary',
            'da1ec3a7497df0aab99e9ea899f0abf2abcfc93aca5d19eb4f950bab8527d4a3@group.calendar.google.com',  # Purdue Classes
            'f1df9996bae26c015e6d86aab12d11afccd600f6732ddf4e4fb1a9b0af55e384@group.calendar.google.com',  # Class Deadlines
        ])
        calendars = list(dict.fromkeys(c.strip() for c in os.getenv('GOOGLE_CALENDAR_IDS', defaults).split(',') if c.strip()))
        return calendars or defaults.split(','), []

    def load(self):
        token = self.access_token()
        now = datetime.now(timezone.utc)
        events = []
        calendars, warnings = self.calendar_ids(token)
        available = 0
        for calendar in calendars:
            try:
                events.extend(self.load_events(token, calendar, now))
                available += 1
            except Exception:
                warnings.append('A Google calendar is unavailable; its events are omitted.')
        if not available:
            raise RuntimeError('Google calendars unavailable')
        return {'events': events, 'source': 'Direct Google Calendar', 'direct': True, 'warnings': warnings}

    def load_events(self, token, calendar, now):
        events = []
        # A failed page discards this calendar's partial snapshot, never resurrecting a mirror.
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
        return events


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


def same_provider_link(a, b):
    """A stable Google source link wins over an old mirrored date after a move."""
    if a['source'] != 'google' or b['source'] != 'notion': return False
    def identity(event):
        url=urlsplit(event.get('url',''))
        if url.scheme!='https' or url.netloc not in ('www.google.com','calendar.google.com'): return None
        if not url.path.startswith('/calendar'): return None
        return parse_qs(url.query).get('eid',[None])[0]
    left,right=identity(a),identity(b)
    return bool(left and right and left==right)


def merge_events(batches):
    merged = []
    for source in ('google', 'outlook', 'notion'):
        for item in batches.get(source, []):
            try:
                event_instant(item['at'])
            except (KeyError, ValueError, TypeError):
                continue
            event = {**item, 'source':source, 'sources':[source], 'sourceIds':{source:item['id']}}
            duplicate = next((e for e in merged if same_provider_link(e,event) or (source == 'notion' and e['source'] == 'google' and same_event(e,event))), None)
            if duplicate:
                duplicate['sources'].append(source)
                duplicate['sourceIds'][source] = item['id']
                if duplicate.get('type') in ('Other','Class','') and item.get('type') not in ('Other','Class','',None):
                    duplicate['type'] = item['type']
                duplicate['course'] = duplicate.get('course') or item.get('course','')
            else:
                merged.append(event)
    return sorted(merged, key=lambda e:(event_instant(e['at']),title_key(e['name']),e['id']))


def load_calendar(include_outlook=False):
    required = ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN')
    missing = [key for key in required if not os.getenv(key, '').strip()]
    batches, status = {}, {}
    warnings = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {'notion':pool.submit(NotionCalendarProvider().load, independent_only=True)}
        if not missing:
            jobs['google'] = pool.submit(DirectGoogleCalendarProvider().load)
        else:
            status['google'] = {'available':False,'count':0,'error':'Direct Google is not configured'}
        for key, job in jobs.items():
            try:
                result = job.result()
                batches[key] = result['events']
                warnings.extend(result.get('warnings', []))
                status[key] = {'available':True,'count':len(batches[key])}
            except Exception:
                error = 'Google events unavailable' if key == 'google' else 'Independent coursework events unavailable'
                status[key] = {'available':False,'count':0,'error':error}
    if include_outlook:
        try:
            from lib.integrations.store import configured, cached_outlook
            cached=cached_outlook() if configured() else None
            if cached:
                batches['outlook']=cached['events']
                status['outlook']={'available':True,'count':len(cached['events']),'lastSync':cached['lastSync'],'stale':cached['status']=='error'}
        except Exception:
            status['outlook']={'available':False,'count':0,'error':'Saved Outlook events unavailable'}
    if not batches:
        raise RuntimeError('Calendar providers unavailable')
    direct = 'google' in batches
    source = 'Direct Google Calendar' if direct else 'Calendar unavailable'
    if batches.get('notion'):
        source = (source + ' + ' if direct else '') + 'independent Purdue coursework'
    if 'outlook' in batches:
        source = source+' + Outlook' if direct or batches.get('notion') else 'Outlook'
    warnings.extend(v['error'] for v in status.values() if not v['available'])
    if status.get('outlook',{}).get('stale'): warnings.append('Outlook sync failed; showing last saved events.')
    if missing:
        status['google'] = {'available':False,'count':0,'error':'Direct Google is not configured'}
        source += ' · Google not configured'
    elif not direct:
        source += ' · Google unavailable'
    return {'events':merge_events(batches), 'source':source, 'direct':direct,
            'providers':status, 'warnings':warnings, 'configurationMissing':missing,
            'updatedAt':datetime.now(timezone.utc).isoformat()}
