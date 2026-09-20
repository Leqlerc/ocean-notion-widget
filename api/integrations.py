import os
from lib.http import JsonHandler
from lib.integrations import store, outlook, brightspace
from lib.integrations.security import require_owner, owner_id


class handler(JsonHandler):
    def do_GET(self):
        try:
            require_owner(self.headers)
            if not store.configured():
                self.send_json(200,{'ready':False,'accounts':[],'error':'Database setup is required before connecting providers.'}); return
            with store.connection() as db:
                accounts=db.execute('SELECT provider,label,last_sync_at,sync_status,sync_error FROM nocean.provider_accounts WHERE owner_id=%s',(owner_id(),)).fetchall()
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
            else: raise ValueError('Unknown integration action.')
            self.send_json(200,result)
        except PermissionError as exc: self.send_json(403,{'error':str(exc)})
        except ValueError as exc: self.send_json(400,{'error':str(exc)})
        except Exception: self.send_json(502,{'error':'Connection or sync failed. Saved data is retained. Check setup or reconnect the provider.'})
