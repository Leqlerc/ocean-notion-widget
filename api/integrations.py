import os
import hmac
import json
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit
from lib.http import JsonHandler
from lib.integrations import store, outlook, brightspace
from lib.integrations.security import require_owner, owner_id


class handler(JsonHandler):
    def scheduled_sync(self, provider):
        secret=os.getenv('CRON_SECRET','')
        if len(secret)<32 or not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+secret):
            self.send_json(403,{'error':'Unauthorized.'}); return
        try:
            if provider not in ('outlook','brightspace'): raise ValueError('Unknown provider.')
            if not store.configured():
                self.send_json(200,{'skipped':'Integration setup incomplete.'}); return
            with store.connection() as db:
                linked=store.account(db,provider)
            if not linked:
                self.send_json(200,{'skipped':'Provider not connected.'}); return
            result=outlook.sync() if provider=='outlook' else brightspace.sync()
            with store.connection() as db:
                db.execute("UPDATE nocean.provider_accounts SET metadata=metadata || %s::jsonb WHERE owner_id=%s AND provider=%s",
                           (json.dumps({'scheduledSync':{'at':datetime.now(timezone.utc).isoformat(),'result':result}}),owner_id(),provider))
            print(json.dumps({'scheduledProvider':provider,'remaining':result.get('remaining',0),'success':True}))
            self.send_json(200,result)
        except Exception: self.send_json(502,{'error':'Sync failed; saved data retained.'})

    def do_GET(self):
        query=parse_qs(urlsplit(self.path).query)
        if 'sync' in query:
            self.scheduled_sync(query['sync'][0]); return
        try:
            require_owner(self.headers)
            if not store.configured():
                self.send_json(200,{'ready':False,'accounts':[],'error':'Database setup is required before connecting providers.'}); return
            with store.connection() as db:
                accounts=db.execute("SELECT provider,label,last_sync_at,sync_status,sync_error,metadata->'syncProgress' AS progress,metadata->'scheduledSync' AS scheduled FROM nocean.provider_accounts WHERE owner_id=%s",(owner_id(),)).fetchall()
                for row in accounts: row['last_sync_at']=str(row['last_sync_at'] or '')
                events=[x['payload'] for x in store.items(db,'outlook')]
            self.send_json(200,{'ready':True,'accounts':accounts,'events':events,'outlookConfigured':outlook.configured()})
        except PermissionError as exc: self.send_json(403,{'error':str(exc)})
        except Exception: self.send_json(503,{'error':'Integration database is unavailable or has not been migrated.'})

    def do_POST(self): self.mutate(False)
    def do_PATCH(self): self.mutate(True)

    def mutate(self, editing):
        provider=None
        try:
            require_owner(self.headers,write=True)
            if not store.configured(): raise RuntimeError('Setup incomplete.')
            data=self.read_json(); action=data.get('action')
            if action=='outlook-connect': result={'url':outlook.begin_auth()}
            elif action=='outlook-sync': provider='outlook'; result=outlook.sync()
            elif action=='outlook-save': provider='outlook'; result=outlook.save_event(data,editing=editing)
            elif action=='brightspace-connect': result=brightspace.connect(data.get('url'))
            elif action=='brightspace-sync': provider='brightspace'; result=brightspace.sync()
            elif action in ('brightspace-review','brightspace-reconcile'):
                from lib.integrations.reconciliation import plan, apply_plan
                from lib.tasks import normalize
                from lib import notion
                reviewed=plan([normalize(page) for page in notion.query(notion.TASKS)])
                if action=='brightspace-review': result=reviewed
                else:
                    if data.get('digest')!=reviewed['digest']: raise ValueError('Tasks changed. Review duplicates again.')
                    result=apply_plan(reviewed)
            else: raise ValueError('Unknown integration action.')
            self.send_json(200,result)
        except PermissionError as exc: self.send_json(403,{'error':str(exc)})
        except ValueError as exc: self.send_json(400,{'error':str(exc)})
        except Exception: self.send_json(502,{'error':'Connection or sync failed. Saved data is retained. Check setup or reconnect the provider.'})
