import unittest
from unittest.mock import patch
from lib.calendar import merge_events, load_calendar
from lib.projects import NotionProjectStore, PROJECTS
from lib.tasks import NotionTaskStore

ENV={k:'configured' for k in ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN']}
def event(id,at='2026-09-18T15:30:00-04:00',**extra):
    return dict(id=id,name='Exam',at=at,type='Other',**extra)

class Merge(unittest.TestCase):
    def test_conservative_dedup_keeps_google_times_and_notion_metadata(self):
        google=event('g',end='2026-09-18T16:30:00-04:00')
        notion=event('n','2026-09-18T19:30:00Z',end='2026-09-18T20:30:00Z');notion.update(type='Exam',course='MA 261')
        result=merge_events({'google':[google],'notion':[notion,event('other','2026-09-18T15:31:00-04:00'),event('date','2026-09-18')]})
        self.assertEqual(len(result),3)
        merged=next(e for e in result if e['id']=='g')
        self.assertEqual(merged['at'],google['at']);self.assertEqual(merged['sources'],['google','notion']);self.assertEqual(merged['course'],'MA 261')
        self.assertEqual(merged['sourceIds'],{'google':'g','notion':'n'})
    def test_same_provider_duplicates_are_preserved_and_sort_uses_instant(self):
        result=merge_events({'google':[event('g')],'notion':[event('n'),event('n2'),event('early','2026-09-18T18:00:00Z')]})
        self.assertEqual(len(result),3);self.assertEqual(result[0]['id'],'early')
    def test_all_day_range_semantics(self):
        a=event('g','2026-09-18',end='2026-09-20',exclusiveEnd=True)
        b=event('n','2026-09-18',end='2026-09-19')
        self.assertEqual(len(merge_events({'google':[a],'notion':[b]})),1)
    def test_notion_failure_keeps_google_and_all_failure_raises(self):
        with patch.dict('os.environ',ENV),patch('lib.calendar.NotionCalendarProvider.load',side_effect=RuntimeError('private detail')),patch('lib.calendar.DirectGoogleCalendarProvider.load',return_value={'events':[event('g')]}):
            result=load_calendar();self.assertTrue(result['direct']);self.assertEqual(len(result['events']),1);self.assertNotIn('private detail',str(result));self.assertTrue(result['warnings'])
        with patch.dict('os.environ',ENV),patch('lib.calendar.NotionCalendarProvider.load',side_effect=RuntimeError()),patch('lib.calendar.DirectGoogleCalendarProvider.load',side_effect=RuntimeError()):
            with self.assertRaises(RuntimeError):load_calendar()

class ProjectsAndDates(unittest.TestCase):
    def test_zero_task_project_is_loaded(self):
        with patch('lib.notion.query',return_value=[{'id':'p','properties':{}}]):
            result=NotionProjectStore().list()['projects'][0];self.assertEqual(result['status'],'Active');self.assertEqual(result['taskIds'],[])
    def test_project_status_changes_only_project_status(self):
        page={'id':'11111111-1111-4111-8111-111111111111','parent':{'data_source_id':PROJECTS},'properties':{}}
        with patch('lib.notion.request',return_value=page) as api:
            NotionProjectStore().update({'id':page['id'],'status':'Completed'})
            self.assertEqual(api.call_args.args[2],{'properties':{'Status':{'select':{'name':'Completed'}}}})
    def test_completion_does_not_touch_project_relation(self):
        self.assertEqual(NotionTaskStore().project_properties({'status':'done'}),{})
    def test_date_only_and_explicit_deadlines(self):
        store=NotionTaskStore()
        for date,offset in [('2026-09-18','-04:00'),('2026-12-18','-05:00')]:
            self.assertEqual(store.properties({'due':date})['Deadline']['date']['start'],date+'T23:59:00'+offset)
        explicit='2026-09-18T15:30:00+05:30'
        self.assertEqual(store.properties({'due':explicit})['Deadline']['date']['start'],explicit)
