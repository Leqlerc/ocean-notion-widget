from lib.http import JsonHandler
from lib.tasks import NotionTaskStore


class handler(JsonHandler):
    def do_GET(self):
        try:
            self.send_json(200, NotionTaskStore().list())
        except Exception:
            self.send_json(502, {'error': 'Tasks unavailable. Please try again.'})

    def write_task(self, create):
        try:
            store = NotionTaskStore()
            data = self.read_json()
            task = store.create(data) if create else store.update(data)
            self.send_json(201 if create else 200, {'task': task})
        except ValueError as exc:
            self.send_json(400, {'error': str(exc)})
        except Exception:
            self.send_json(502, {'error': 'Could not confirm the save. Refresh before retrying.'})

    def do_POST(self):
        self.write_task(True)

    def do_PATCH(self):
        self.write_task(False)
