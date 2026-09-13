"""TaskStore boundary: replacing this class does not change the HTTP or UI contract."""
from datetime import date, datetime
from uuid import UUID
from lib import notion

STATUSES = {'inbox': 'Inbox', 'next': 'Next', 'doing': 'Doing', 'waiting': 'Waiting', 'done': 'Done'}
FIELDS = {'id', 'name', 'status', 'focus', 'course', 'project', 'due'}


def normalize(page):
    get = lambda name: notion.value(page, name)
    return {'id': page['id'], 'name': get('Task') or 'Untitled task',
            'status': (get('Status') or 'Inbox').lower(), 'focus': bool(get('Focus')),
            'course': get('Course') or '', 'project': get('Project') or '',
            'due': get('Deadline'), 'scheduledFor': get('Do date'),
            'completedOn': get('Date Completed'), 'url': page.get('url', '')}


def validate(data, creating=False):
    if set(data) - FIELDS:
        raise ValueError('Unknown task field.')
    if creating and 'name' not in data:
        raise ValueError('A task name is required.')
    for key in ('name', 'course', 'project'):
        if key in data:
            if not isinstance(data[key], str) or len(data[key]) > (500 if key == 'name' else 100):
                raise ValueError('Invalid ' + key + '.')
            data[key] = data[key].strip()
            if key == 'name' and not data[key]:
                raise ValueError('A task name is required.')
    if 'status' in data and data['status'] not in STATUSES:
        raise ValueError('Invalid task status.')
    if 'focus' in data and type(data['focus']) is not bool:
        raise ValueError('Focus must be true or false.')
    if data.get('due'):
        if not isinstance(data['due'], str):
            raise ValueError('Invalid due date.')
        if len(data['due']) == 10:
            date.fromisoformat(data['due'])
        else:
            datetime.fromisoformat(data['due'].replace('Z', '+00:00'))
    elif 'due' in data and data['due'] not in ('', None):
        raise ValueError('Invalid due date.')
    return data


class NotionTaskStore:
    def list(self):
        tasks = [normalize(p) for p in notion.query(notion.TASKS)]
        schema = notion.request('GET', '/data_sources/' + notion.TASKS)['properties']
        courses = [x['name'] for x in schema.get('Course', {}).get('select', {}).get('options', [])]
        return {'tasks': tasks, 'courses': courses, 'statuses': list(STATUSES),
                'updatedAt': datetime.now(notion.TZ).isoformat()}

    def properties(self, data, existing=None):
        props = {}
        for field, name, kind in [('name', 'Task', 'title'), ('project', 'Project', 'rich_text')]:
            if field in data:
                props[name] = {kind: [{'text': {'content': data[field]}}] if data[field] else []}
        if 'course' in data:
            props['Course'] = {'select': {'name': data['course']} if data['course'] else None}
        if 'focus' in data:
            props['Focus'] = {'checkbox': data['focus']}
        if 'due' in data:
            props['Deadline'] = {'date': {'start': data['due']} if data['due'] else None}
        if 'status' in data:
            props['Status'] = {'select': {'name': STATUSES[data['status']]}}
            was_done = existing and notion.value(existing, 'Status') == 'Done'
            if data['status'] == 'done':
                if not was_done or not notion.value(existing, 'Date Completed'):
                    props['Date Completed'] = {'date': {'start': datetime.now(notion.TZ).date().isoformat()}}
            else:
                props['Date Completed'] = {'date': None}
        return props

    def create(self, data):
        data = validate(data, creating=True)
        if 'id' in data:
            raise ValueError('New tasks cannot specify an ID.')
        data.setdefault('focus', True)
        data.setdefault('status', 'next')
        page = notion.request('POST', '/pages', {
            'parent': {'type': 'data_source_id', 'data_source_id': notion.TASKS},
            'properties': self.properties(data)})
        return normalize(page)

    def owned_page(self, data):
        try:
            task_id = str(UUID(str(data.get('id', ''))))
        except (ValueError, TypeError):
            raise ValueError('Invalid task ID.')
        page = notion.request('GET', '/pages/' + task_id)
        parent = page.get('parent', {})
        if parent.get('data_source_id', '').replace('-', '') != notion.TASKS.replace('-', ''):
            raise ValueError('This task is not in the task store.')
        if page.get('archived') or page.get('in_trash'):
            raise ValueError('This task has been archived.')
        return page

    def update(self, data):
        data = validate(data)
        page = self.owned_page(data)
        return normalize(notion.request('PATCH', '/pages/' + page['id'],
                         {'properties': self.properties(data, page)}))

    def archive(self, data):
        if set(data) != {'id'}:
            raise ValueError('Expected a task ID.')
        page = self.owned_page(data)
        notion.request('PATCH', '/pages/' + page['id'], {'in_trash': True})
        return {'id': page['id'], 'archived': True}
