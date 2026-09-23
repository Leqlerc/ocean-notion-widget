"""Dry-run first. Archive only proven generated duplicates; never delete user tasks."""
import hashlib
import json
from lib import notion
from lib.tasks import normalize, NotionTaskStore
from lib.integrations import store
from lib.integrations.security import owner_id
from lib.integrations.coursework import identity, canonical_rank, compatible


def plan(tasks):
    groups={}
    for task in tasks:
        key=identity(task)
        if key: groups.setdefault(key,[]).append(task)
    pairs=[];conflicts=[]
    for key,items in groups.items():
        if len(items)<2: continue
        canonical=min(items,key=canonical_rank)
        for item in items:
            if item['id']==canonical['id'] or not str(item.get('sourceId','')).startswith('brightspace:'): continue
            row={'keep':canonical['id'],'archive':item['id'],'name':item['name'],'identity':key}
            (pairs if compatible(canonical,item) else conflicts).append(row)
    payload=json.dumps(pairs,sort_keys=True)
    return {'pairs':pairs,'conflicts':conflicts,'digest':hashlib.sha256(payload.encode()).hexdigest()}


def apply_plan(reviewed,limit=4):
    # Re-read live records before any write; any identity/state drift stops the run.
    fresh=plan([normalize(p) for p in notion.query(notion.TASKS)])
    if fresh['digest']!=reviewed['digest']: raise ValueError('Tasks changed since dry run; review a fresh plan.')
    for pair in fresh['pairs'][:limit]:
        # A task body can contain user notes beyond normalized properties.
        body=notion.request('GET','/blocks/'+pair['archive']+'/children?page_size=1')
        if body.get('results'): raise ValueError('Redundant task contains notes; preserve it for manual review.')
        with store.connection() as db:
            store.lock(db,'brightspace')
            # Map first: a crash before archive can only leave a harmless duplicate.
            for table,column in [('provider_items','local_id'),('provider_operations','external_id')]:
                db.execute(f'UPDATE nocean.{table} SET {column}=%s WHERE owner_id=%s AND provider=%s AND {column}=%s',
                           (pair['keep'],owner_id(),'brightspace',pair['archive']))
        NotionTaskStore().archive({'id':pair['archive']})
    return {'archived':min(limit,len(fresh['pairs'])),'remaining':max(0,len(fresh['pairs'])-limit)}

