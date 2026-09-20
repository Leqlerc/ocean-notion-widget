from lib.http import JsonHandler
from lib.integrations import security, store


class handler(JsonHandler):
    def do_GET(self):
        data=security.session(self.headers)
        self.send_json(200,{'authenticated':bool(data),'csrf':data['csrf'] if data else None,'configured':store.configured()})

    def do_POST(self):
        try:
            security.check_origin(self.headers)
            data=self.read_json()
            if data.get('action')=='logout':
                security.require_owner(self.headers,write=True)
                value=''
            else: value=security.new_session(data.get('secret'))
            self.send_response(200)
            self.send_header('Set-Cookie',security.cookie_header(value,clear=not value))
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Type','application/json')
            self.end_headers(); self.wfile.write(b'{"ok":true}')
        except PermissionError as exc: self.send_json(403,{'error':str(exc)})
        except ValueError: self.send_json(400,{'error':'Invalid request.'})
        except Exception: self.send_json(503,{'error':'Owner access is not configured yet.'})
