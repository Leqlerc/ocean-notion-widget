from lib.http import JsonHandler
from lib.dining import load_dining


class handler(JsonHandler):
    def do_GET(self):
        try:
            self.send_json(200, load_dining(), 'public, max-age=60, s-maxage=120')
        except Exception:
            self.send_json(502, {'error': 'Dining data unavailable. Try again shortly.'})
