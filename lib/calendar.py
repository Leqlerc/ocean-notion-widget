"""CalendarProvider boundary. Google is preferred only when server credentials exist."""
import json
import os
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
        return {'events': events, 'source': 'Synced events · updates may be delayed', 'direct': False}


class GoogleCalendarProvider:
    def load(self):
        payload = urlencode({'client_id': os.environ['GOOGLE_CLIENT_ID'],
            'client_secret': os.environ['GOOGLE_CLIENT_SECRET'],
            'refresh_token': os.environ['GOOGLE_REFRESH_TOKEN'], 'grant_type': 'refresh_token'}).encode()
        with urlopen(Request('https://oauth2.googleapis.com/token', data=payload), timeout=10) as r:
            token = json.load(r)['access_token']
        now = datetime.now(timezone.utc)
        events = []
        for calendar in os.getenv('GOOGLE_CALENDAR_IDS', 'primary').split(','):
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
                    events.append({'id': calendar + ':' + e['id'], 'name': e.get('summary', 'Event'),
                        'at': start.get('dateTime') or start.get('date'),
                        'end': end.get('dateTime') or end.get('date'),
                        'exclusiveEnd': True, 'type': 'Other', 'course': '', 'url': e.get('htmlLink', '')})
                page = data.get('nextPageToken')
                if not page:
                    break
        return {'events': events, 'source': 'Google Calendar · checked every 45s', 'direct': True}


def load_calendar():
    configured = [bool(os.getenv(k)) for k in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN')]
    provider = GoogleCalendarProvider() if all(configured) else NotionCalendarProvider()
    result = provider.load()
    result['updatedAt'] = datetime.now(timezone.utc).isoformat()
    return result
