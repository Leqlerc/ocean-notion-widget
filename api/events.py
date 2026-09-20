from lib.http import JsonHandler
from lib.calendar import load_calendar
from lib.integrations.security import session


class handler(JsonHandler):
    def do_GET(self):
        try:
            self.send_json(200, load_calendar(include_outlook=bool(session(self.headers))))
        except Exception:
            self.send_json(502, {'error': 'Calendar unavailable. Please try again.'})
