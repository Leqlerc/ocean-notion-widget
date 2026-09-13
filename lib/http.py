import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit


class JsonHandler(BaseHTTPRequestHandler):
    def send_json(self, status, payload, cache='no-store'):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        origin = self.headers.get('Origin')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            raise ValueError('Cross-origin writes are not allowed.')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            raise ValueError('Cross-site writes are not allowed.')
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            raise ValueError('Expected JSON.')
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= 16384:
            raise ValueError('Invalid request size.')
        body = json.loads(self.rfile.read(length))
        if not isinstance(body, dict):
            raise ValueError('Expected an object.')
        return body
