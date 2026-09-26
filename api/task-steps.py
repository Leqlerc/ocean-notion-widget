from urllib.parse import parse_qs, urlsplit
from lib.http import JsonHandler
from lib.task_steps import TaskStepStore


class handler(JsonHandler):
    def respond(self, status, operation):
        try:
            self.send_json(status, operation())
        except ValueError as exc:
            self.send_json(400, {'error': str(exc)})
        except Exception:
            self.send_json(502, {'error': 'Could not confirm the step save. Refresh before retrying.'})

    def do_GET(self):
        query = parse_qs(urlsplit(self.path).query)
        self.respond(200, lambda: TaskStepStore().list(query.get('task', [''])[0]))

    def do_POST(self):
        self.respond(201, lambda: TaskStepStore().create(self.read_json()))

    def do_PATCH(self):
        self.respond(200, lambda: TaskStepStore().update(self.read_json()))

    def do_DELETE(self):
        self.respond(200, lambda: TaskStepStore().remove(self.read_json()))
