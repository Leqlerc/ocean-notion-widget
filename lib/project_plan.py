"""Native Notion goal blocks, additive to the existing Projects store.

Every item is an independently addressable native block. No JSON document or
history blob is stored in a page property. Existing unmarked notes are untouched.
SQL can later adopt these stable block IDs without rewriting task planning.
"""
from datetime import date
from urllib.parse import urlsplit, parse_qs, urlencode
from uuid import UUID
from lib import notion
from lib.projects import NotionProjectStore

KINDS={'objective':'to_do','milestone':'to_do','overview':'paragraph','note':'paragraph'}
MARKER='https://ocean-notion-widget.vercel.app/projects.html'


def normalize(block):
    if block.get('in_trash') or block.get('archived'): return None
    content=block.get(block.get('type'),{}); rich=content.get('rich_text',[])
    if not rich: return None
    first=rich[0]; link=(first.get('text',{}).get('link') or {}).get('url','')
    u=urlsplit(link)
    if u.scheme!='https' or u.netloc!='ocean-notion-widget.vercel.app' or u.path!='/projects.html': return None
    q=parse_qs(u.query);kind=q.get('goalKind',[''])[0];key=q.get('goalKey',[''])[0]
    if kind not in KINDS or block.get('type')!=KINDS[kind]: return None
    try:key=str(UUID(key))
    except ValueError:return None
    title=first.get('plain_text',first.get('text',{}).get('content',''))
    due=None
    for entry in rich[1:]:
        if entry.get('type')=='mention' and entry.get('mention',{}).get('type')=='date':
            due=entry['mention']['date'].get('start')
    return {'id':block['id'],'requestId':key,'kind':kind,'text':title,'due':due,
            'done':bool(content.get('checked',False)),'editedAt':block.get('last_edited_time')}


def validate(data):
    if set(data)-{'projectId','id','requestId','kind','text','due','done','editedAt','action'}:
        raise ValueError('Unknown goal field.')
    kind=data.get('kind')
    if kind not in KINDS: raise ValueError('Choose objective, milestone, overview or note.')
    value=data.get('text')
    maximum=1800 if kind in ('overview','note') else 300
    if not isinstance(value,str) or not 1<=len(value.strip())<=maximum: raise ValueError(f'Use text of 1–{maximum} characters.')
    due=data.get('due') or None
    if due:
        if kind!='milestone' or not isinstance(due,str) or len(due)!=10: raise ValueError('Only milestones have a date, in YYYY-MM-DD format.')
        date.fromisoformat(due)
    if type(data.get('done',False)) is not bool: raise ValueError('Completion must be true or false.')
    return {**data,'text':value.strip(),'due':due,'done':data.get('done',False)}


def block_payload(data):
    kind=data['kind'];rich=[{'type':'text','text':{'content':data['text'],'link':{'url':MARKER+'?'+urlencode({'goalKind':kind,'goalKey':data['requestId']})}}}]
    if data.get('due'):
        rich.extend([{'type':'text','text':{'content':' · '}},
                     {'type':'mention','mention':{'type':'date','date':{'start':data['due']}}}])
    content={'rich_text':rich}
    if KINDS[kind]=='to_do':content['checked']=data['done']
    return {'object':'block','type':KINDS[kind],KINDS[kind]:content}


class ProjectPlanStore:
    def list(self,project_id):
        page=NotionProjectStore().owned(project_id)
        records=[];cursor=None
        for _ in range(10):
            path='/blocks/'+page['id']+'/children?page_size=100'
            if cursor:path+='&'+urlencode({'start_cursor':cursor})
            data=notion.request('GET',path)
            records.extend(item for block in data.get('results',[]) if (item:=normalize(block)))
            if not data.get('has_more'):return {'items':records,'projectId':page['id']}
            cursor=data['next_cursor']
        raise ValueError('Project content is too large to safely edit here. Open its Notion page.')

    def create(self,data):
        data=validate(data)
        if data.get('id'):raise ValueError('A new goal item cannot specify a block ID.')
        try:data['requestId']=str(UUID(data.get('requestId','')))
        except (ValueError,TypeError,AttributeError):raise ValueError('A stable save ID is required.')
        records=self.list(data.get('projectId'))['items']
        existing=[x for x in records if x['requestId']==data['requestId']]
        if len(existing)>1:raise ValueError('This save already has duplicate blocks. Review them in Notion.')
        if existing:
            if any(existing[0][key]!=data[key] for key in ('kind','text','due','done')):raise ValueError('This save ID belongs to another item. Refresh before creating a new one.')
            return {'item':existing[0]}
        result=notion.request('PATCH','/blocks/'+data['projectId']+'/children',{'children':[block_payload(data)]})
        return {'item':normalize(result['results'][0])}

    def update(self,data):
        records=self.list(data.get('projectId'))['items']
        old=next((x for x in records if x['id']==data.get('id')),None)
        if not old:raise ValueError('Goal item is outside this project or was removed.')
        if data.get('editedAt')!=old['editedAt']:raise ValueError('This item changed in Notion. Refresh before saving.')
        if data.get('action')=='remove':
            if set(data)-{'projectId','id','editedAt','action'}:raise ValueError('Invalid remove request.')
            notion.request('PATCH','/blocks/'+old['id'],{'in_trash':True})
            return {'removed':old['id']}
        data=validate({**old,**data,'requestId':old['requestId']})
        if data['kind']!=old['kind']:raise ValueError('Keep the existing item type.')
        payload=block_payload(data);kind=KINDS[data['kind']]
        result=notion.request('PATCH','/blocks/'+old['id'],{kind:payload[kind]})
        return {'item':normalize(result)}
