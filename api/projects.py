from lib.http import JsonHandler
from lib.projects import NotionProjectStore

class handler(JsonHandler):
    def respond(self, operation):
        try: self.send_json(200,operation())
        except ValueError as exc: self.send_json(400,{'error':str(exc)})
        except Exception: self.send_json(502,{'error':'Projects unavailable. Refresh before retrying a save.'})
    def do_GET(self): self.respond(lambda:NotionProjectStore().list())
    def do_POST(self): self.respond(lambda:{'project':NotionProjectStore().create(self.read_json())})
    def do_PATCH(self): self.respond(lambda:{'project':NotionProjectStore().update(self.read_json())})
