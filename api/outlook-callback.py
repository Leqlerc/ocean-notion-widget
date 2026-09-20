from urllib.parse import urlsplit, parse_qs
from lib.http import JsonHandler
from lib.integrations.security import require_owner
from lib.integrations.outlook import finish_auth


class handler(JsonHandler):
    # Do not log OAuth query strings, which contain one-use authorization codes.
    def log_message(self, *args): pass

    def do_GET(self):
        result='connected'
        try:
            require_owner(self.headers)
            query=parse_qs(urlsplit(self.path).query)
            finish_auth(query.get('state',[''])[0],query.get('code',[''])[0])
        except Exception: result='connection-failed'
        self.send_response(303)
        self.send_header('Location','/integrations.html?outlook='+result)
        self.send_header('Cache-Control','no-store')
        self.send_header('Referrer-Policy','no-referrer')
        self.end_headers()
