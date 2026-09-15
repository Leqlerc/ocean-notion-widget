"""Independent project lifecycle; related tasks from every category count equally."""
import os
from datetime import datetime, date
from uuid import UUID
from lib import notion

PROJECTS = os.getenv('NOTION_PROJECTS_DATA_SOURCE_ID','8772813a-3a37-49d5-8719-c508aca035e6')
STATUSES = ('Active','Completed','Archived')


def normalize(page):
    return {'id':page['id'],'name':notion.value(page,'Name') or 'Untitled project',
            'due':notion.value(page,'Due Date'),'status':notion.value(page,'Status') or 'Active','url':page.get('url',''),
            'taskIds':[r['id'] for r in notion.value(page,'Tasks') or []]}


class NotionProjectStore:
    def list(self):
        # Include inactive records so the UI can restore projects without resurrecting them from tasks.
        return {'projects':[normalize(p) for p in notion.query(PROJECTS)],'statuses':list(STATUSES),
                'updatedAt':datetime.now(notion.TZ).isoformat()}

    def owned(self,id):
        try: id=str(UUID(str(id)))
        except ValueError: raise ValueError('Invalid project ID.')
        page=notion.request('GET','/pages/'+id)
        if page.get('parent',{}).get('data_source_id','').replace('-','') != PROJECTS.replace('-','') or page.get('in_trash') or page.get('archived'):
            raise ValueError('Project is outside the active project store.')
        return page

    def resolve(self,name):
        name=name.strip()
        rows=notion.query(PROJECTS,{'property':'Name','title':{'equals':name}})
        if len(rows)>1: raise ValueError('Duplicate project names; select the project by ID.')
        return normalize(rows[0]) if rows else self.create({'name':name})

    def create(self,data):
        if set(data)-{'name','due'} or 'name' not in data or not isinstance(data['name'],str) or not 1<=len(data['name'].strip())<=100:
            raise ValueError('Use a project name of 1–100 characters.')
        due=data.get('due')
        if due: date.fromisoformat(due)
        name=data['name'].strip()
        rows=notion.query(PROJECTS,{'property':'Name','title':{'equals':name}})
        if rows: return normalize(rows[0])
        return normalize(notion.request('POST','/pages',{'parent':{'type':'data_source_id','data_source_id':PROJECTS},
            'properties':{'Name':{'title':[{'text':{'content':name}}]},'Status':{'select':{'name':'Active'}},'Due Date':{'date':{'start':due} if due else None}}}))

    def update(self,data):
        if 'id' not in data or not (set(data)-{'id'}) or set(data)-{'id','status','due'}: raise ValueError('Invalid project fields.')
        props={}
        if 'status' in data:
            if data['status'] not in STATUSES: raise ValueError('Invalid project status.')
            props['Status']={'select':{'name':data['status']}}
        if 'due' in data:
            due=data['due']
            if due:
                if not isinstance(due,str): raise ValueError('Invalid project date.')
                date.fromisoformat(due)
            props['Due Date']={'date':{'start':due} if due else None}
        page=self.owned(data['id'])
        return normalize(notion.request('PATCH','/pages/'+page['id'],{'properties':props}))
