"""Local read-only provider proxy for visual checks; writes remain in memory."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlsplit
from uuid import uuid4
import sys
from datetime import datetime, timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.integrations.coursework import visible_tasks

records=visible_tasks(json.loads(Path('.vercel/production-tasks.json').read_text())['tasks'])
for task in records:
    task.setdefault('taskType','Simple');task.setdefault('steps',[])
cache={}
plans={}


class Handler(SimpleHTTPRequestHandler):
    def respond(self,data):
        body=json.dumps(data).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)

    def do_GET(self):
        parsed=urlsplit(self.path);path=parsed.path
        if path=='/api/tasks' and parsed.query.startswith('steps='):
            task_id=parsed.query.split('=',1)[1]
            task=next((t for t in records if t['id']==task_id),None)
            return self.respond({'taskId':task_id,'steps':task.get('steps',[]) if task else []})
        if path=='/api/tasks': return self.respond({'tasks':records,'courses':sorted({t['course'] for t in records if t.get('course')}),'statuses':['next','done']})
        if path=='/api/projects' and parsed.query.startswith('plan='):
            project_id=parsed.query.split('=',1)[1]
            return self.respond({'projectId':project_id,'items':plans.get(project_id,[])})
        if path=='/api/integration-session': return self.respond({'configured':True,'authenticated':False})
        if path.startswith('/api/'):
            if path not in ['/api/projects','/api/events','/api/recwell','/api/dining']: return self.send_error(404)
            if path not in cache:
                with urlopen('https://ocean-notion-widget.vercel.app'+path,timeout=55) as result: cache[path]=json.load(result)
            return self.respond(cache[path])
        if any(part.startswith('.') for part in path.split('/') if part): return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path=='/api/tasks' and not data.pop('step',False):
            task={'id':str(uuid4()),'status':'next','steps':[],'projectIds':[data['projectId']] if data.get('projectId') else [],**data};records.append(task);return self.respond({'task':task})
        if self.path=='/api/tasks':
            task=next(t for t in records if t['id']==data['taskId']);step={'id':str(uuid4()),'editedAt':'preview','done':False,**data};task['steps'].append(step);return self.respond({'step':step,'parent':{'id':task['id'],'status':task['status']}})
        if self.path=='/api/projects' and data.pop('plan',False):
            item={'id':str(uuid4()),'editedAt':datetime.now(timezone.utc).isoformat(),'createdAt':data.get('createdAt') or datetime.now(timezone.utc).isoformat(),'status':data.get('status'),**data};plans.setdefault(data['projectId'],[]).append(item);return self.respond({'item':item})
        return self.send_error(404)

    def do_PATCH(self):
        change=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path=='/api/tasks' and not change.pop('step',False):
            task=next(t for t in records if t['id']==change['id']);task.update(change);return self.respond({'task':task})
        if self.path=='/api/tasks':
            task=next(t for t in records if t['id']==change['taskId']);step=next(s for s in task['steps'] if s['id']==change['id']);step.update(change);step['editedAt']='preview';task['status']='done' if task['steps'] and all(s['done'] for s in task['steps']) else 'next';return self.respond({'step':step,'parent':{'id':task['id'],'status':task['status']}})
        if self.path=='/api/projects' and change.pop('plan',False):
            item=next(i for i in plans.get(change['projectId'],[]) if i['id']==change['id']);item.update(change);return self.respond({'item':item})
        return self.send_error(404)

    def do_DELETE(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path=='/api/tasks' and data.pop('step',False):
            task=next(t for t in records if t['id']==data['taskId']);task['steps']=[s for s in task['steps'] if s['id']!=data['id']];return self.respond({'removed':data['id'],'parent':{'id':task['id'],'status':task['status']}})
        return self.send_error(404)


if __name__=='__main__': ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
