"""TaskStore boundary: replacing this class does not change the HTTP or UI contract."""
from datetime import date, datetime
from uuid import UUID
from lib import notion

STATUSES = {'inbox': 'Inbox', 'next': 'Next', 'doing': 'Doing', 'waiting': 'Waiting', 'done': 'Done'}
PRIORITIES = ('Critical', 'High', 'Normal', 'Low')
FIELDS = {'id', 'name', 'status', 'focus', 'course', 'project', 'projectId', 'due', 'difficulty', 'priority', 'scheduledFor', 'planningMode'}


def normalize(page):
    get = lambda name: notion.value(page, name)
    return {'id': page['id'], 'name': get('Task') or 'Untitled task',
            'status': (get('Status') or 'Inbox').lower(), 'focus': bool(get('Focus')),
            'difficulty': get('Difficulty') or 'Unrated', 'priority': get('Priority') or 'Normal', 'course': get('Course') or '', 'project': get('Project') or '',
            'projectIds':[r['id'] for r in get('Projects') or []],
            'due': get('Deadline'), 'scheduledFor': get('Do date'),
            'planningMode':(get('Planning Mode') or 'Automatic').lower(), 'sourceId':get('Source ID') or None, 'sourceUrl':get('Source') or None, 'sourceCalendar':get('Source calendar') or None,
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
    if 'difficulty' in data and data['difficulty'] not in ('Unrated','Easy','Medium','Hard'):
        raise ValueError('Invalid difficulty.')
    if 'priority' in data and data['priority'] not in PRIORITIES:
        raise ValueError('Invalid priority.')
    if 'status' in data and data['status'] not in STATUSES:
        raise ValueError('Invalid task status.')
    if 'focus' in data and type(data['focus']) is not bool:
        raise ValueError('Focus must be true or false.')
    if 'projectId' in data and data['projectId'] is not None:
        try: data['projectId'] = str(UUID(str(data['projectId'])))
        except ValueError: raise ValueError('Invalid project ID.')
    if 'planningMode' in data and data['planningMode'] not in ('automatic','planned','backlog'):
        raise ValueError('Invalid planning mode.')
    if 'scheduledFor' in data:
        planned=data['scheduledFor']
        if planned is not None:
            if not isinstance(planned,str) or len(planned)!=10: raise ValueError('Use a plan date in YYYY-MM-DD format.')
            date.fromisoformat(planned)
    if data.get('planningMode')=='planned' and not data.get('scheduledFor'):
        raise ValueError('A planned task needs a plan date.')
    if data.get('planningMode')=='backlog' and data.get('scheduledFor'):
        raise ValueError('Backlog tasks cannot have a plan date.')
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
    def schema(self):
        return notion.request('GET', '/data_sources/' + notion.TASKS).get('properties', {})

    def ensure_priority(self):
        current = self.schema().get('Priority')
        if current and current.get('type') == 'select':
            return
        if current:
            raise ValueError('The Notion Priority property must be a Select field.')
        notion.request('PATCH', '/data_sources/' + notion.TASKS, {'properties': {
            'Priority': {'select': {'options': [{'name': level} for level in PRIORITIES]}}
        }})

    def clear_focus(self, except_id=None):
        pages = notion.query(notion.TASKS, {'property': 'Focus', 'checkbox': {'equals': True}})
        for page in pages:
            task = normalize(page)
            if page['id'] != except_id and not str(task.get('sourceId') or '').startswith('brightspace:'):
                notion.request('PATCH', '/pages/' + page['id'], {'properties': {'Focus': {'checkbox': False}}})

    def list(self):
        from lib.integrations.coursework import visible_tasks
        tasks = [normalize(p) for p in notion.query(notion.TASKS)]
        tasks = visible_tasks(tasks)
        schema = notion.request('GET', '/data_sources/' + notion.TASKS)['properties']
        courses = [x['name'] for x in schema.get('Course', {}).get('select', {}).get('options', [])]
        return {'tasks': tasks, 'courses': courses, 'statuses': list(STATUSES),
                'updatedAt': datetime.now(notion.TZ).isoformat()}

    def properties(self, data, existing=None):
        props = {}
        for field, name, kind in [('name', 'Task', 'title'), ('project', 'Project', 'rich_text')]:
            if field in data:
                props[name] = {kind: [{'text': {'content': data[field]}}] if data[field] else []}
        if 'scheduledFor' in data:
            props['Do date']={'date':{'start':data['scheduledFor']} if data['scheduledFor'] else None}
        if 'planningMode' in data:
            props['Planning Mode']={'select':{'name':data['planningMode'].capitalize()}}
        if 'difficulty' in data:
            props['Difficulty']={'select':{'name':data['difficulty']} if data['difficulty']!='Unrated' else None}
        if 'priority' in data:
            props['Priority']={'select':{'name':data['priority']}}
        if 'course' in data:
            props['Course'] = {'select': {'name': data['course']} if data['course'] else None}
        if 'focus' in data:
            props['Focus'] = {'checkbox': data['focus']}
        if 'due' in data:
            due = data['due']
            if due:
                dt = datetime.fromisoformat(due.replace('Z','+00:00'))
                if len(due)==10: dt=dt.replace(hour=23,minute=59)
                if dt.tzinfo is None: dt=dt.replace(tzinfo=notion.TZ)
                due=dt.isoformat()
            props['Deadline'] = {'date': {'start': due} if due else None}
        if 'status' in data:
            props['Status'] = {'select': {'name': STATUSES[data['status']]}}
            was_done = existing and notion.value(existing, 'Status') == 'Done'
            if data['status'] == 'done':
                if not was_done or not notion.value(existing, 'Date Completed'):
                    props['Date Completed'] = {'date': {'start': datetime.now(notion.TZ).date().isoformat()}}
            else:
                props['Date Completed'] = {'date': None}
        return props

    def project_properties(self,data):
        if 'projectId' not in data and 'project' not in data: return {}
        from lib.projects import NotionProjectStore, normalize as project_summary
        store=NotionProjectStore()
        if data.get('projectId'):
            project=project_summary(store.owned(data['projectId']))
        elif data.get('project') and 'projectId' not in data:
            project=store.resolve(data['project'])
        else:
            project=None
        data['project']=project['name'] if project else ''
        return {'Projects':{'relation':[{'id':project['id']}] if project else []}}

    def create(self, data):
        data = validate(data, creating=True)
        if 'id' in data:
            raise ValueError('New tasks cannot specify an ID.')
        data.setdefault('focus', False)
        data.setdefault('priority', 'Normal')
        data.setdefault('status', 'next')
        self.ensure_priority()
        if data['focus']:
            self.clear_focus()
        relation = self.project_properties(data)
        page = notion.request('POST', '/pages', {
            'parent': {'type': 'data_source_id', 'data_source_id': notion.TASKS},
            'properties': {**self.properties(data),**relation}})
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
        if 'priority' in data:
            self.ensure_priority()
        if data.get('focus'):
            self.clear_focus(page['id'])
        relation = self.project_properties(data)
        return normalize(notion.request('PATCH', '/pages/' + page['id'],
                         {'properties': {**self.properties(data, page),**relation}}))

    def archive(self, data):
        if set(data) != {'id'}:
            raise ValueError('Expected a task ID.')
        page = self.owned_page(data)
        notion.request('PATCH', '/pages/' + page['id'], {'in_trash': True})
        return {'id': page['id'], 'archived': True}
