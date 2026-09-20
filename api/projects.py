from lib.http import JsonHandler
from lib.projects import NotionProjectStore
from lib.project_plan import ProjectPlanStore
from urllib.parse import urlsplit, parse_qs

class handler(JsonHandler):
    def respond(self, operation):
        try: self.send_json(200,operation())
        except ValueError as exc: self.send_json(400,{'error':str(exc)})
        except Exception: self.send_json(502,{'error':'Projects unavailable. Refresh before retrying a save.'})
    def do_GET(self):
        query=parse_qs(urlsplit(self.path).query)
        self.respond(lambda:ProjectPlanStore().list(query['plan'][0]) if 'plan' in query else NotionProjectStore().list())
    def mutate(self,editing):
        data=self.read_json()
        if data.pop('plan',False):
            # Same store-scoped, same-origin mutation boundary as existing Projects.
            return ProjectPlanStore().update(data) if editing else ProjectPlanStore().create(data)
        return {'project':NotionProjectStore().update(data) if editing else NotionProjectStore().create(data)}
    def do_POST(self): self.respond(lambda:self.mutate(False))
    def do_PATCH(self): self.respond(lambda:self.mutate(True))
