"""Shared server-only Notion transport. Provider IDs never enter the browser."""
import json
import os
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

TZ = ZoneInfo('America/Indiana/Indianapolis')
TASKS = os.getenv('NOTION_TASKS_DATA_SOURCE_ID', 'cbb2eff8-e4cf-497f-919b-1d8bfccb9153')
EVENTS = os.getenv('NOTION_EVENTS_DATA_SOURCE_ID', 'edda9dd0-e4bd-4c48-a80d-361484f07ff9')


def request(method, path, payload=None):
    token = os.getenv('NOTION_TOKEN', '').strip()
    if not token:
        raise RuntimeError('Task/event connection is not configured.')
    req = Request('https://api.notion.com/v1' + path,
                  data=None if payload is None else json.dumps(payload).encode(),
                  method=method, headers={'Authorization': 'Bearer ' + token,
                  'Notion-Version': '2026-03-11', 'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=15) as response:
            return json.load(response)
    except HTTPError as exc:
        # Provider responses can include private page details. Keep them server-side.
        raise RuntimeError('Task/event provider rejected the request (%s).' % exc.code) from exc


def query(source, filter=None):
    rows, cursor = [], None
    while True:
        body = {'page_size': 100}
        if filter:
            body['filter'] = filter
        if cursor:
            body['start_cursor'] = cursor
        result = request('POST', '/data_sources/' + source + '/query', body)
        rows.extend(result.get('results', []))
        if not result.get('has_more'):
            return rows
        cursor = result['next_cursor']


def value(page, name):
    p = page.get('properties', {}).get(name, {})
    kind = p.get('type')
    v = p.get(kind) if kind else None
    if kind in ('title', 'rich_text'):
        return ''.join(x.get('plain_text', x.get('text', {}).get('content', '')) for x in v or [])
    if kind in ('select', 'status'):
        return (v or {}).get('name', '')
    if kind == 'date':
        return (v or {}).get('start')
    if kind == 'formula':
        return (v or {}).get((v or {}).get('type'))
    return v


def local_day(v):
    if not v:
        return None
    if len(v) == 10:
        return v
    dt = datetime.fromisoformat(v.replace('Z', '+00:00'))
    return dt.replace(tzinfo=TZ).date().isoformat() if dt.tzinfo is None else dt.astimezone(TZ).date().isoformat()
