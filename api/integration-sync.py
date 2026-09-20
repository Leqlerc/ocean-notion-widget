"""Daily scheduler; no public unauthenticated writes."""
import hmac
import os
from urllib.parse import parse_qs,urlsplit
from lib.http import JsonHandler
from lib.integrations import outlook,brightspace,store


class handler(JsonHandler):
    def do_GET(self):
        expected=os.getenv('CRON_SECRET','')
        if len(expected)<32 or not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+expected):
            self.send_json(403,{'error':'Unauthorized.'}); return
        try:
            if not store.configured():
                self.send_json(200,{'skipped':'Integration setup incomplete.'}); return
            provider=parse_qs(urlsplit(self.path).query).get('provider',[''])[0]
            if provider not in ('outlook','brightspace'): raise ValueError('Unknown provider.')
            with store.connection() as db:
                linked=store.account(db,provider)
            if not linked:
                self.send_json(200,{'skipped':'Provider not connected.'}); return
            self.send_json(200,outlook.sync() if provider=='outlook' else brightspace.sync())
        except Exception: self.send_json(502,{'error':'Sync failed; saved data retained.'})
