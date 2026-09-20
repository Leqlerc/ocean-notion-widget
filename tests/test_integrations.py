import os
import unittest
from datetime import datetime,timezone
from unittest.mock import patch,MagicMock
from contextlib import contextmanager
from lib.integrations import security,store,outlook,brightspace
from lib.calendar import merge_events, load_calendar

ENV={'NOCEAN_OWNER_ID':'11111111-1111-4111-8111-111111111111','NOCEAN_OWNER_SECRET':'a'*40,
     'NOCEAN_PUBLIC_ORIGIN':'https://nocean.example'}

class OwnerTests(unittest.TestCase):
    @patch.dict(os.environ,ENV)
    def test_session_and_csrf(self):
        cookie=security.new_session('a'*40)
        headers={'Cookie':security.COOKIE+'='+cookie,'Origin':ENV['NOCEAN_PUBLIC_ORIGIN']}
        data=security.require_owner(headers)
        with self.assertRaises(PermissionError): security.require_owner(headers,write=True)
        headers['X-NOcean-CSRF']=data['csrf'];security.require_owner(headers,write=True)
        headers['Origin']='https://other.example'
        with self.assertRaises(PermissionError): security.require_owner(headers,write=True)
        headers['Cookie']+='tampered';self.assertIsNone(security.session(headers))
        with self.assertRaises(PermissionError):security.new_session('bad')
    @patch.dict(os.environ,ENV)
    def test_expiry(self):
        with patch('lib.integrations.security.time.time',return_value=0): cookie=security.new_session('a'*40)
        self.assertIsNone(security.session({'Cookie':security.COOKIE+'='+cookie}))
    def test_encryption(self):
        from cryptography.fernet import Fernet
        with patch.dict(os.environ,{'NOCEAN_TOKEN_KEY':Fernet.generate_key().decode()}):
            value=store.encrypt('private-refresh-token'); self.assertNotIn('private',value)
            self.assertEqual(store.decrypt(value),'private-refresh-token')

EVENT={'id':'immutable-1','subject':'Office hours','start':{'dateTime':'2026-09-24T16:00:00','timeZone':'UTC'},
       'end':{'dateTime':'2026-09-24T17:00:00','timeZone':'UTC'},'@odata.etag':'v1','attendees':[]}
class OutlookTests(unittest.TestCase):
    def test_pagination_move_and_cancellation(self):
        moved={**EVENT,'start':{'dateTime':'2026-09-24T18:00:00','timeZone':'UTC'}}
        with patch.object(outlook,'graph',side_effect=[{'value':[EVENT], '@odata.nextLink':outlook.GRAPH+'/next'}, {'value':[moved]}]):
            result=outlook.fetch_events('token','account')
        self.assertEqual(len(result),1);self.assertTrue(result['immutable-1']['at'].startswith('2026-09-24T18:00'))
        with patch.object(outlook,'graph',return_value={'value':[{**EVENT,'isCancelled':True}]}):
            self.assertEqual(outlook.fetch_events('token','account'),{})
    def test_foreign_pagination_rejected(self):
        with self.assertRaises(ValueError):outlook.graph('secret','https://evil.example/v1.0/me')
    def test_failed_page_does_not_replace_snapshot(self):
        db=MagicMock()
        @contextmanager
        def connection():yield db
        with patch.object(store,'connection',connection),patch.object(store,'lock'),patch.object(outlook,'access',return_value=({'account_id':'a'},'t')),patch.object(outlook,'graph',side_effect=[{'value':[EVENT],'@odata.nextLink':outlook.GRAPH+'/next'},RuntimeError('failed')]),patch.object(store,'failed') as fail:
            with self.assertRaises(RuntimeError):outlook.sync()
        self.assertFalse(any('DELETE FROM nocean.provider_items' in str(c) for c in db.execute.call_args_list));fail.assert_called_once_with('outlook')
    def test_create_retry_uses_same_transaction(self):
        data={'name':'Test','at':'2026-09-24T12:00:00-04:00','end':'2026-09-24T13:00:00-04:00','operationId':'22222222-2222-4222-8222-222222222222'}
        db=MagicMock();db.execute.return_value.fetchone.return_value=None
        @contextmanager
        def connection():yield db
        with patch.dict(os.environ,ENV),patch.object(store,'connection',connection),patch.object(store,'lock'),patch.object(store,'put_item'),patch.object(store,'account',return_value={'account_id':'a'}),patch.object(outlook,'access',return_value=({'account_id':'a'},'t')),patch.object(outlook,'graph',return_value=EVENT) as graph:
            outlook.save_event(data);outlook.save_event(data)
            self.assertEqual([c.args[3]['transactionId'] for c in graph.call_args_list],[data['operationId']]*2)
    def test_event_validation(self):
        with self.assertRaises(ValueError):outlook.event_payload({'name':'x','at':'2026-09-24T12:00','end':'2026-09-24T13:00'})
        payload=outlook.event_payload({'name':'x','at':'2026-09-24T12:00-04:00','end':'2026-09-24T13:00-04:00'})
        self.assertEqual(payload['start']['dateTime'],'2026-09-24T16:00:00')

FEED=b'''BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:assignment-1\r
SUMMARY:MA 261 Homework\r
DTSTART;VALUE=DATE:20260924\r
SEQUENCE:1\r
URL:https://purdue.brightspace.com/d2l/le/content/1/viewContent/2/View\r
END:VEVENT\r
END:VCALENDAR\r
'''
class BrightspaceTests(unittest.TestCase):
    def test_stable_id_changed_date_and_local_default(self):
        first=brightspace.parse_feed(FEED)['items'][0]
        second=brightspace.parse_feed(FEED.replace(b'20260924',b'20260925'))['items'][0]
        self.assertEqual(first['sourceId'],second['sourceId']); self.assertTrue(first['due'].endswith('23:59:00-04:00'))
        self.assertEqual(first['course'],'MA 261');self.assertFalse(brightspace.parse_feed(FEED)['completionAvailable'])
    def test_duplicate_and_invalid_feed(self):
        event=FEED.split(b'BEGIN:VEVENT')[1].split(b'END:VEVENT')[0]
        doubled=FEED.replace(b'END:VCALENDAR',b'BEGIN:VEVENT'+event+b'END:VEVENT\r\nEND:VCALENDAR')
        self.assertEqual(len(brightspace.parse_feed(doubled)['items']),1)
        with self.assertRaises(ValueError):brightspace.parse_feed(b'<html>Login</html>')
        for url in ('https://evil.example/d2l/feed','https://purdue.brightspace.com@evil.example/d2l/feed','http://purdue.brightspace.com/d2l/feed'):
            with self.assertRaises(ValueError):brightspace.validate_feed_url(url)
    def test_recovery_updates_existing_and_preserves_user_fields(self):
        item=brightspace.parse_feed(FEED)['items'][0]
        page={'id':'task-1'}
        with patch.object(brightspace,'source_matches',return_value=[page]),patch.object(brightspace.notion,'request',return_value=page) as request:
            local,action=brightspace.sync_task(item)
        self.assertEqual((local,action),('task-1','updated'))
        props=request.call_args.args[2]['properties']
        for name in ('Status','Focus','Do date','Planning Mode','Projects','Difficulty','Date Completed'):
            self.assertNotIn(name,props)
    def test_uncertain_create_never_blindly_retries(self):
        item=brightspace.parse_feed(FEED)['items'][0]
        with patch.object(brightspace,'source_matches',return_value=[]),patch.object(brightspace.notion,'request') as request:
            with self.assertRaises(ValueError): brightspace.sync_task(item,allow_create=False)
            request.assert_not_called()
    def test_archive_does_not_recreate(self):
        with patch.object(brightspace.NotionTaskStore,'owned_page',side_effect=ValueError('archived')),patch.object(brightspace.notion,'request') as request:
            self.assertEqual(brightspace.sync_task({},'task-1'),('task-1','archived')); request.assert_not_called()

class CalendarIdentityTests(unittest.TestCase):
    def test_saved_outlook_survives_other_provider_failure(self):
        event={'id':'o','name':'Saved','at':'2026-09-25T12:00:00Z'}
        with patch.dict(os.environ,{},clear=True),patch('lib.calendar.NotionCalendarProvider.load',side_effect=RuntimeError('down')),patch.object(store,'configured',return_value=True),patch.object(store,'cached_outlook',return_value={'events':[event],'lastSync':'2026-09-20','status':'ok'}):
            result=load_calendar(include_outlook=True)
        self.assertEqual(len(result['events']),1);self.assertTrue(result['source'].startswith('Outlook'))

    def test_moved_google_mirror_is_one_event(self):
        a={'id':'g','name':'New title','at':'2026-09-25T12:00:00Z','url':'https://www.google.com/calendar/event?eid=stable&ctz=UTC'}
        b={'id':'n','name':'Old title','at':'2026-09-24T12:00:00Z','url':'https://www.google.com/calendar/event?eid=stable&ctz=America/New_York'}
        events=merge_events({'google':[a],'notion':[b]})
        self.assertEqual(len(events),1);self.assertEqual(events[0]['at'],a['at']);self.assertEqual(events[0]['sourceIds'],{'google':'g','notion':'n'})
    def test_unrelated_outlook_event_not_collapsed_by_title(self):
        event={'id':'g','name':'Meeting','at':'2026-09-25T12:00:00Z'}
        self.assertEqual(len(merge_events({'google':[event],'outlook':[{**event,'id':'o'}]})),2)

if __name__=='__main__':unittest.main()
