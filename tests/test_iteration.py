import io
import json
import unittest
from datetime import datetime
from unittest.mock import patch
from lib import notion
from lib.calendar import DirectGoogleCalendarProvider, NotionCalendarProvider, load_calendar
from lib.athletics import NotionAthleticsProvider, DAILY, EXERCISES, SETS

ID='11111111-1111-4111-8111-111111111111'
TODAY=datetime.now(notion.TZ).date().isoformat()
def page(source=DAILY):
    return {'id':ID,'parent':{'data_source_id':source},'properties':{'Date':{'type':'date','date':{'start':TODAY}},'Exercise':{'type':'title','title':[{'plain_text':'Row'}]}}}

class Calendar(unittest.TestCase):
    def test_missing_google_never_falls_back_to_notion(self):
        with patch.dict('os.environ',{},clear=True), patch('lib.calendar.NotionCalendarProvider.load',return_value={'events':[],'direct':False}) as notion, patch.object(DirectGoogleCalendarProvider,'load') as direct:
            result=load_calendar();self.assertFalse(result['direct']);self.assertEqual(len(result['configurationMissing']),3);direct.assert_not_called();notion.assert_called_once_with(independent_only=True);self.assertEqual(result['events'],[])

    def test_deleted_google_mirror_never_returns(self):
        env={k:'configured' for k in ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN']}
        with patch.dict('os.environ',env),patch.object(DirectGoogleCalendarProvider,'load',return_value={'events':[]}),patch('lib.calendar.NotionCalendarProvider.load',return_value={'events':[]}) as notion:
            result=load_calendar();self.assertTrue(result['direct']);notion.assert_called_once_with(independent_only=True);self.assertEqual(result['events'],[])
        with patch.dict('os.environ',env),patch.object(DirectGoogleCalendarProvider,'load',side_effect=RuntimeError('Google unavailable')),patch('lib.calendar.NotionCalendarProvider.load',return_value={'events':[]}):
            result=load_calendar();self.assertFalse(result['direct']);self.assertIn('Google events unavailable',result['warnings'])

    def test_google_pagination_and_cancelled_events(self):
        responses=[{'items':[{'id':'a','summary':'MA 261 Lecture','recurringEventId':'series','start':{'date':'2026-09-14'},'end':{'date':'2026-09-15'}},{'id':'b','status':'cancelled'},{'id':'c'}],'nextPageToken':'next'}, {'items':[{'id':'d','summary':'MA 261 Quiz','recurringEventId':'series','start':{'dateTime':'2026-09-15T10:00:00-04:00'}}]}]
        with patch.dict('os.environ',{'GOOGLE_CALENDAR_IDS':' primary, primary, '}),patch.object(DirectGoogleCalendarProvider,'access_token',return_value='secret'),patch('lib.calendar.urlopen',side_effect=[io.BytesIO(json.dumps(r).encode()) for r in responses]) as http:
            result=DirectGoogleCalendarProvider().load();self.assertEqual(len(result['events']),2);self.assertEqual(result['events'][0]['type'],'Class');self.assertEqual(result['events'][1]['type'],'Other');self.assertIn('pageToken=next',http.call_args.args[0].full_url)

    def test_both_calendars_and_exact_rfc3339(self):
        event={'id':'a','summary':'Class','recurringEventId':'series','start':{'dateTime':'2026-09-18T15:30:17-04:00'},'end':{'dateTime':'2026-09-18T16:20:17-04:00'}}
        with patch.dict('os.environ',{'GOOGLE_CALENDAR_IDS':'primary,classes@group.calendar.google.com'}),patch.object(DirectGoogleCalendarProvider,'access_token',return_value='secret'),patch('lib.calendar.urlopen',side_effect=[io.BytesIO(json.dumps({'items':[event]}).encode()) for _ in range(2)]) as http:
            result=DirectGoogleCalendarProvider().load()['events'];self.assertEqual(len(result),2)
            self.assertEqual(result[0]['at'],event['start']['dateTime']);self.assertEqual(result[0]['end'],event['end']['dateTime'])
            for call in http.call_args_list:self.assertIn('singleEvents=true',call.args[0].full_url)
            self.assertTrue(result[1]['id'].startswith('classes@group.calendar.google.com:'))

    def test_known_calendar_defaults_and_partial_failure(self):
        with patch.dict('os.environ',{},clear=True):
            ids,warnings=DirectGoogleCalendarProvider().calendar_ids('token')
        self.assertEqual(len(ids),3);self.assertEqual(ids[0],'primary');self.assertEqual(warnings,[])
        self.assertTrue(all(i.endswith('@group.calendar.google.com') for i in ids[1:]))
        ids=['primary','classes','deadlines']
        def events(token,calendar,now):
            if calendar=='deadlines': raise RuntimeError('unavailable')
            return [{'id':calendar,'at':'2099-01-01','name':'Lecture'}]
        with patch.object(DirectGoogleCalendarProvider,'access_token',return_value='token'),patch.object(DirectGoogleCalendarProvider,'calendar_ids',return_value=(ids,[])),patch.object(DirectGoogleCalendarProvider,'load_events',side_effect=events):
            result=DirectGoogleCalendarProvider().load()
        self.assertEqual(len(result['events']),2);self.assertEqual(len(result['warnings']),1)

    def test_independent_notion_allowlist_excludes_mirrors(self):
        pages=[{'id':str(i),'properties':{'Date':{'date':{'start':'2099-01-01'}}},'values':{'Date':'2099-01-01','Event':name,'Source':url}} for i,(name,url) in enumerate([
            ('Deload week','https://calendar.google.com/calendar/event?eid=deleted'),
            ('Unknown origin',''),('Quiz','https://www.math.purdue.edu/course'),
            ('Spoof','https://purdue.edu.example.org/course')])]
        with patch('lib.calendar.notion.query',return_value=pages),patch('lib.calendar.notion.value',side_effect=lambda p,k:p['values'].get(k)):
            result=NotionCalendarProvider().load(independent_only=True)
        self.assertEqual([e['name'] for e in result['events']],['Quiz'])

    def test_token_cache(self):
        env={k:'configured' for k in ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN']}
        with patch.dict('os.environ',env),patch.object(DirectGoogleCalendarProvider,'_token',None),patch.object(DirectGoogleCalendarProvider,'_expires_at',0),patch('lib.calendar.urlopen',return_value=io.BytesIO(b'{"access_token":"cached","expires_in":3600}')) as http:
            self.assertEqual(DirectGoogleCalendarProvider().access_token(),'cached');self.assertEqual(DirectGoogleCalendarProvider().access_token(),'cached');self.assertEqual(http.call_count,1)

class Athletics(unittest.TestCase):
    def test_completion_changes_only_training_fields(self):
        with patch('lib.notion.query',return_value=[page()]),patch('lib.notion.request',return_value=page()) as http:
            NotionAthleticsProvider().update_day({'date':TODAY,'quality':'Productive','workoutType':'Push'})
            self.assertEqual(set(http.call_args.args[2]['properties']),{'Workout Quality','Workout Type','Log'})
            NotionAthleticsProvider().update_day({'date':TODAY,'quality':''})
            self.assertIsNone(http.call_args.args[2]['properties']['Workout Quality']['select'])

    def test_reject_unrelated_fields_and_invalid_sets(self):
        provider=NotionAthleticsProvider()
        with patch('lib.notion.request') as http,patch('lib.notion.query') as query:
            for body in [{'date':TODAY,'sleep':True},{'date':TODAY,'support':{'habit':True}},{'date':TODAY,'support':{'rehab':'yes'}}]:
                with self.assertRaises(ValueError):provider.update_day(body)
            with self.assertRaises(ValueError):provider.add_set({'date':TODAY,'reps':10,'load':30,'externalLoad':False,'warmup':False})
            query.assert_not_called();http.assert_not_called()

    def test_duplicate_daily_log_rejects_write(self):
        with patch('lib.notion.query',return_value=[page(),page()]),patch('lib.notion.request') as http:
            with self.assertRaises(ValueError):NotionAthleticsProvider().update_day({'date':TODAY,'support':{'swim':True}})
            http.assert_not_called()

    def test_cross_store_archive_rejected(self):
        with patch('lib.notion.request',return_value=page(EXERCISES)) as http:
            with self.assertRaises(ValueError):NotionAthleticsProvider().archive_set({'id':ID})
            self.assertEqual(http.call_count,1)

    def test_retry_does_not_create_another_set(self):
        with patch('lib.notion.query',return_value=[{'id':ID,'properties':{}}]),patch('lib.notion.request',return_value=page(EXERCISES)) as http:
            NotionAthleticsProvider().add_set({'date':TODAY,'exerciseId':ID,'reps':10,'load':20,'externalLoad':True,'warmup':False,'requestId':ID})
            self.assertEqual(http.call_count,1);self.assertEqual(http.call_args.args[0],'GET')

    def test_exercise_failure_keeps_day_available(self):
        def query(source,*args):
            if source==EXERCISES:raise RuntimeError('unavailable')
            return [page()] if source==DAILY else []
        with patch('lib.notion.query',side_effect=query):
            result=NotionAthleticsProvider().load(TODAY)
            self.assertFalse(result['canLogSets']);self.assertEqual(result['day']['date'],TODAY);self.assertEqual(len(result['week']),7)

if __name__=='__main__':unittest.main()
