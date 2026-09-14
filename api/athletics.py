from datetime import datetime
from urllib.parse import parse_qs, urlsplit
from lib.http import JsonHandler
from lib.athletics import NotionAthleticsProvider
from lib.notion import TZ


class handler(JsonHandler):
    def respond(self, operation):
        try:
            self.send_json(200, operation())
        except ValueError as exc:
            self.send_json(400, {'error':str(exc)})
        except Exception:
            self.send_json(502, {'error':'Training connection unavailable. Refresh before retrying a save.'})

    def do_GET(self):
        key = parse_qs(urlsplit(self.path).query).get('date',[datetime.now(TZ).date().isoformat()])[0]
        self.respond(lambda:NotionAthleticsProvider().load(key))

    def do_POST(self):
        self.respond(lambda:NotionAthleticsProvider().add_set(self.read_json()))

    def do_PATCH(self):
        self.respond(lambda:NotionAthleticsProvider().update_day(self.read_json()))

    def do_DELETE(self):
        self.respond(lambda:NotionAthleticsProvider().archive_set(self.read_json()))
