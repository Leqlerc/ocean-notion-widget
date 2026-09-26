"""NOcean-owned task steps stored as tagged native child to-do blocks."""
from datetime import date
from urllib.parse import parse_qs, urlencode, urlsplit
from uuid import UUID
from lib import notion

MARKER = 'https://ocean-notion-widget.vercel.app/tasks.html'


def normalize(block):
    if block.get('in_trash') or block.get('archived') or block.get('type') != 'to_do':
        return None
    content = block.get('to_do', {})
    rich = content.get('rich_text', [])
    if not rich:
        return None
    first = rich[0]
    link = (first.get('text', {}).get('link') or {}).get('url', '')
    parsed = urlsplit(link)
    if parsed.scheme != 'https' or parsed.netloc != 'ocean-notion-widget.vercel.app' or parsed.path != '/tasks.html':
        return None
    query = parse_qs(parsed.query)
    try:
        key = str(UUID(query.get('stepKey', [''])[0]))
    except ValueError:
        return None
    planned = query.get('stepDate', [None])[0] or None
    if planned:
        try:
            date.fromisoformat(planned)
        except ValueError:
            return None
    return {'id': block['id'], 'requestId': key,
            'name': first.get('plain_text', first.get('text', {}).get('content', '')),
            'plannedFor': planned, 'done': bool(content.get('checked', False)),
            'editedAt': block.get('last_edited_time')}


def validate(data):
    if set(data) - {'taskId', 'id', 'requestId', 'name', 'plannedFor', 'done', 'editedAt'}:
        raise ValueError('Unknown task step field.')
    name = data.get('name')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 300:
        raise ValueError('Use a step name of 1–300 characters.')
    planned = data.get('plannedFor') or None
    if planned:
        if not isinstance(planned, str) or len(planned) != 10:
            raise ValueError('Use a step date in YYYY-MM-DD format.')
        date.fromisoformat(planned)
    if type(data.get('done', False)) is not bool:
        raise ValueError('Completion must be true or false.')
    return {**data, 'name': name.strip(), 'plannedFor': planned, 'done': data.get('done', False)}


def block_payload(data):
    query = {'stepKey': data['requestId']}
    if data.get('plannedFor'):
        query['stepDate'] = data['plannedFor']
    return {'object': 'block', 'type': 'to_do', 'to_do': {
        'rich_text': [{'type': 'text', 'text': {'content': data['name'], 'link': {'url': MARKER + '?' + urlencode(query)}}}],
        'checked': data['done']}}


class TaskStepStore:
    def parent(self, task_id):
        from lib.tasks import NotionTaskStore, normalize as normalize_task
        page = NotionTaskStore().owned_page({'id': task_id})
        task = normalize_task(page)
        if str(task.get('sourceId') or '').startswith('brightspace:'):
            raise ValueError('Imported coursework cannot own manual task steps.')
        if task['taskType'] != 'Multi-step':
            raise ValueError('Task steps belong to a Multi-step task.')
        return page

    def list_for_page(self, task_id):
        records, cursor = [], None
        for _ in range(10):
            path = '/blocks/' + task_id + '/children?page_size=100'
            if cursor:
                path += '&' + urlencode({'start_cursor': cursor})
            data = notion.request('GET', path)
            records.extend(item for block in data.get('results', []) if (item := normalize(block)))
            if not data.get('has_more'):
                return records
            cursor = data['next_cursor']
        raise ValueError('Task content is too large to safely edit here. Open its Notion page.')

    def list(self, task_id):
        page = self.parent(task_id)
        return {'taskId': page['id'], 'steps': self.list_for_page(page['id'])}

    def create(self, data):
        data = validate(data)
        page = self.parent(data.get('taskId'))
        if data.get('id'):
            raise ValueError('A new step cannot specify a block ID.')
        try:
            data['requestId'] = str(UUID(data.get('requestId', '')))
        except (ValueError, TypeError, AttributeError):
            raise ValueError('A stable save ID is required.')
        existing = [x for x in self.list_for_page(page['id']) if x['requestId'] == data['requestId']]
        if len(existing) > 1:
            raise ValueError('This save already has duplicate steps. Review them in Notion.')
        if existing:
            if any(existing[0][key] != data[key] for key in ('name', 'plannedFor', 'done')):
                raise ValueError('This save ID belongs to another step. Refresh before creating a new one.')
            return {'step': existing[0], 'parent': self.sync_parent(page['id'])}
        result = notion.request('PATCH', '/blocks/' + page['id'] + '/children', {'children': [block_payload(data)]})
        return {'step': normalize(result['results'][0]), 'parent': self.sync_parent(page['id'])}

    def update(self, data):
        data = validate(data)
        page = self.parent(data.get('taskId'))
        records = self.list_for_page(page['id'])
        old = next((x for x in records if x['id'] == data.get('id')), None)
        if not old:
            raise ValueError('Step is outside this task or was removed.')
        if data.get('editedAt') != old['editedAt']:
            raise ValueError('This step changed in Notion. Refresh before saving.')
        data = validate({**old, **data, 'requestId': old['requestId']})
        result = notion.request('PATCH', '/blocks/' + old['id'], {'to_do': block_payload(data)['to_do']})
        return {'step': normalize(result), 'parent': self.sync_parent(page['id'])}

    def remove(self, data):
        if set(data) != {'taskId', 'id', 'editedAt'}:
            raise ValueError('Expected task and step identity.')
        page = self.parent(data.get('taskId'))
        old = next((x for x in self.list_for_page(page['id']) if x['id'] == data.get('id')), None)
        if not old:
            raise ValueError('Step is outside this task or was removed.')
        if data.get('editedAt') != old['editedAt']:
            raise ValueError('This step changed in Notion. Refresh before removing it.')
        notion.request('PATCH', '/blocks/' + old['id'], {'in_trash': True})
        return {'removed': old['id'], 'parent': self.sync_parent(page['id'])}

    def sync_parent(self, task_id):
        from lib.tasks import NotionTaskStore
        steps = self.list_for_page(task_id)
        store = NotionTaskStore()
        page = store.owned_page({'id': task_id})
        current = (notion.value(page, 'Status') or 'Inbox').lower()
        desired = 'done' if steps and all(step['done'] for step in steps) else ('next' if current == 'done' else current)
        if desired != current:
            page = notion.request('PATCH', '/pages/' + task_id, {'properties': store.properties({'status': desired}, page)})
        return {'id': task_id, 'status': desired}
