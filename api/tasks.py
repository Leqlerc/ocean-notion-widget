from lib.http import JsonHandler
from lib.tasks import NotionTaskStore
from lib.task_steps import TaskStepStore
from urllib.parse import parse_qs, urlsplit


class handler(JsonHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlsplit(self.path).query)
            self.send_json(200, TaskStepStore().list(query['steps'][0]) if 'steps' in query else NotionTaskStore().list())
        except Exception:
            self.send_json(502, {'error': 'Tasks unavailable. Please try again.'})

    def write_task(self, create):
        try:
            store = NotionTaskStore()
            data = self.read_json()
            if data.pop('step', False):
                result = TaskStepStore().create(data) if create else TaskStepStore().update(data)
            else:
                result = {'task': store.create(data) if create else store.update(data)}
            self.send_json(201 if create else 200, result)
        except ValueError as exc:
            self.send_json(400, {'error': str(exc)})
        except Exception:
            self.send_json(502, {'error': 'Could not confirm the save. Refresh before retrying.'})

    def do_POST(self):
        self.write_task(True)

    def do_PATCH(self):
        self.write_task(False)

    def do_DELETE(self):
        try:
            data = self.read_json()
            self.send_json(200, TaskStepStore().remove(data) if data.pop('step', False) else NotionTaskStore().archive(data))
        except ValueError as exc:
            self.send_json(400, {'error': str(exc)})
        except Exception:
            self.send_json(502, {'error': 'Could not confirm the archive. Refresh before retrying.'})
