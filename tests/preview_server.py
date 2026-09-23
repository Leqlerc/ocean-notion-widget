"""Local read-only provider proxy for visual checks; writes remain in memory."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlsplit
from uuid import uuid4
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.integrations.coursework import visible_tasks

records=visible_tasks(json.loads(Path('.vercel/production-tasks.json').read_text())['tasks'])
cache={}


class Handler(SimpleHTTPRequestHandler):
    def respond(self,data):
        body=json.dumps(data).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)

    def do_GET(self):
        path=urlsplit(self.path).path
        if path=='/api/tasks': return self.respond({'tasks':records,'courses':sorted({t['course'] for t in records if t.get('course')}),'statuses':['next','done']})
        if path=='/api/integration-session': return self.respond({'configured':True,'authenticated':False})
        if path.startswith('/api/'):
            if path not in ['/api/projects','/api/events','/api/recwell','/api/dining']: return self.send_error(404)
            if path not in cache:
                with urlopen('https://ocean-notion-widget.vercel.app'+path,timeout=55) as result: cache[path]=json.load(result)
            return self.respond(cache[path])
        if any(part.startswith('.') for part in path.split('/') if part): return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        if self.path!='/api/tasks': return self.send_error(404)
        task={'id':str(uuid4()),'status':'next',**json.loads(self.rfile.read(int(self.headers['Content-Length'])))}
        records.append(task);self.respond({'task':task})

    def do_PATCH(self):
        if self.path!='/api/tasks': return self.send_error(404)
        change=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        task=next(t for t in records if t['id']==change['id']);task.update(change);self.respond({'task':task})


if __name__=='__main__': ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
