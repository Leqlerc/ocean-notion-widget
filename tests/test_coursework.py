import unittest
from unittest.mock import patch, MagicMock
from contextlib import contextmanager
from lib.integrations import brightspace, coursework, store
from lib.tasks import normalize


def item(name='HQ 12-1 - Due',unit='1640342',due='2026-10-02T23:59:00-04:00',**extra):
    return dict(id=name,name=name,sourceId='brightspace:'+name,sourceUrl=f'https://purdue.brightspace.com/d2l/le/content/{unit}/viewContent/123/View',due=due,**extra)


class CourseworkTests(unittest.TestCase):
    def test_confirmed_courses_and_generic_container(self):
        for unit,course in coursework.ORG_COURSES.items():
            self.assertEqual(coursework.course_for('Homework',item(unit=unit)['sourceUrl']),course)
        self.assertEqual(coursework.course_for('Homework','https://purdue.brightspace.com/d2l/le/calendar/6824'),'')
        self.assertEqual(coursework.course_for('Homework','https://purdue.brightspace.com/d2l/le/calendar/6824','CS 159'),'CS 159')
        self.assertEqual(coursework.org_unit('https://purdue.brightspace.com/d2l/common/dialogs/quickLink/quickLink.d2l?ou=36061&type=content'),'36061')

    def test_exact_wrappers_dates_and_courses(self):
        original=item()
        for name in ['MFET 163 — HQ 12-1','Submission Folder Special Access: HQ 12-1 - Due']:
            self.assertEqual(coursework.identity(original),coursework.identity(item(name)))
        for other in [item('HQ 12-2'),item(unit='1631262'),item(due='2026-10-02T20:00:00-04:00')]:
            self.assertNotEqual(coursework.identity(original),coursework.identity(other))
        self.assertNotEqual(coursework.title_key('HQ 12-1'),coursework.title_key('HQ 1-21'))

    def test_lifecycle_never_counts_as_obligation(self):
        due=item();available=item('HQ 12-1 - Available',due='2026-09-20T00:00:00-04:00')
        ends=item('HQ 12-1 - Availability Ends');lone=item('Safety module - Available',unit='1134648')
        self.assertEqual(coursework.actionable([due,available,ends,lone]),[due])

    def test_read_deduplication_preserves_user_owned_state(self):
        clean=item('MFET 163 — HQ 12-1',status='done',planningMode='planned',scheduledFor='2026-09-30',difficulty='Hard',focus=True,project='Design')
        clean['sourceId']=None;clean['course']='MFET 163'
        result=coursework.visible_tasks([item(),clean])
        self.assertEqual(result,[clean])
        conflict=item(difficulty='Easy')
        self.assertEqual(len(coursework.visible_tasks([conflict,clean])),2)

    def test_feed_collapses_different_urls_and_filters_lifecycle(self):
        events=[]
        for idx,(name,day) in enumerate([('HQ 12-1 - Due','20261002'),('MFET 163 — HQ 12-1','20261002'),('HQ 12-1 - Available','20260920')]):
            events.append(f'BEGIN:VEVENT\r\nUID:{idx}\r\nSUMMARY:{name}\r\nDTSTART;VALUE=DATE:{day}\r\nURL:https://purdue.brightspace.com/d2l/le/content/1640342/viewContent/{idx}/View\r\nEND:VEVENT\r\n')
        result=brightspace.parse_feed(('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+''.join(events)+'END:VCALENDAR').encode())
        self.assertEqual(len(result['items']),1);self.assertEqual(result['skipped'],2)
        self.assertEqual(result['items'][0]['aliases'],['1'])

    def test_sync_partial_does_not_advance_success_timestamp(self):
        records=[dict(externalId=str(i),sourceId='brightspace:'+str(i),name='Homework '+str(i),course='CS 159',due='2099-10-02T23:59:00-04:00',url='https://purdue.brightspace.com/d2l/le/calendar/6824') for i in range(3)]
        db=MagicMock();db.execute.return_value.fetchone.return_value=None
        @contextmanager
        def connection(): yield db
        with patch.object(store,'connection',connection),patch.object(store,'lock'),patch.object(store,'account',return_value={'account_id':'purdue','secret_ciphertext':'x'}),patch.object(store,'decrypt',return_value='url'),patch.object(store,'put_item'),patch.object(store,'sync_progress') as progress,patch.object(store,'synced') as synced,patch.object(brightspace,'owner_id',return_value='owner'),patch.object(brightspace,'fetch_feed',return_value={'items':records,'skipped':0}),patch.object(brightspace.notion,'query',return_value=[]),patch.object(brightspace,'sync_task',return_value=('task','created')):
            result=brightspace.sync(limit=1)
            self.assertEqual(result['remaining'],2);synced.assert_not_called();progress.assert_called_once()

    def test_failure_retains_existing_snapshot(self):
        with patch.object(store,'connection',side_effect=RuntimeError('unavailable')),patch.object(store,'failed') as failed:
            with self.assertRaises(RuntimeError): brightspace.sync()
            failed.assert_called_once_with('brightspace')

    def test_source_url_alone_never_merges_distinct_work(self):
        record=dict(externalId='new',sourceId='brightspace:new',name='Different assignment',course='MFET 163',due='2026-10-02T23:59:00-04:00',url=item()['sourceUrl'])
        page=brightspace.tasks_page('old',{**record,'name':'Original assignment','sourceId':'brightspace:old'})
        self.assertIsNone(brightspace.existing_match(record,[page]))

    def test_due_record_wins_over_same_time_lifecycle(self):
        due=item();ends=item('HQ 12-1 - Availability Ends')
        ends['id']='aaa';due['id']='zzz'
        self.assertEqual([t['id'] for t in coursework.visible_tasks([ends,due])],['zzz'])

    def test_reconciliation_preserves_conflicts_and_manual_tasks(self):
        from lib.integrations.reconciliation import plan
        clean=item('MFET 163 — HQ 12-1',status='done',difficulty='Hard')
        clean['sourceId']=None
        result=plan([clean,item(),item('HQ 12-1',difficulty='Easy')])
        self.assertEqual(len(result['pairs']),1);self.assertEqual(len(result['conflicts']),1)
        self.assertEqual(result['pairs'][0]['keep'],clean['id'])
