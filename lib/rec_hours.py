"""Official EMS feed used by Purdue's Facilities and Hours component."""
import json
from datetime import datetime, timedelta
from urllib.parse import urlencode
from urllib.request import urlopen
from lib.notion import TZ

BASE = 'https://itap.purdue.edu/apps/emsproxy/api/'


def load_hours(facility):
    now = datetime.now(TZ)
    today = now.strftime('%m/%d/%Y')
    params = {'startDate': today, 'endDate': (now + timedelta(days=1)).strftime('%m/%d/%Y')}
    if facility == 'corec':
        params['buildingIds'] = 7
        path = 'Hours'
    else:
        params['roomId'] = 400
        path = 'Bookings'
    result = {'date': now.date().isoformat(), 'hours': None, 'closed': None,
              'source': 'https://www.purdue.edu/recwell/', 'source_label': 'Purdue EMS schedule'}
    try:
        with urlopen(BASE + path + '?' + urlencode(params), timeout=10) as r:
            data = json.load(r)
        if facility == 'corec':
            locations = [l for l in data.get('locations', []) if l.get('id') == 7]
            rows = locations[0].get('hours', []) if locations else []
        else:
            rows = [b for b in data.get('bookings', []) if b.get('roomId') == 400 and
                    b.get('eventName', '').lower() == 'open recreation' and b.get('status') == 'Confirmed']
        windows, labels = [], []
        for row in rows:
            start = row.get('openDateTime') or row.get('startDateTime')
            end = row.get('closeDateTime') or row.get('endDateTime')
            if not start or not end:
                continue
            start, end = datetime.fromisoformat(start), datetime.fromisoformat(end)
            if start.astimezone(TZ).date() != now.date():
                continue
            if row.get('closedAllDay'):
                continue
            if row.get('openAllDay'):
                labels.append('Open all day'); windows.append((now-timedelta(days=1), now+timedelta(days=1)))
            else:
                labels.append(start.strftime('%-I:%M %p') + '–' + end.strftime('%-I:%M %p'))
                windows.append((start,end))
        # The official aquatic page interprets an empty day's booking list as closed.
        if rows or (facility == 'aquatic' and 'bookings' in data):
            result['hours'] = ' · '.join(labels) if labels else 'Closed today'
            result['closed'] = not any(start <= now < end for start,end in windows)
        result['fetched'] = True
    except Exception:
        result['fetched'] = False
    return result
