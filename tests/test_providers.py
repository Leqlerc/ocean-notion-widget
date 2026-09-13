"""Contract checks; never write to the live task database."""
import unittest
from datetime import datetime
from unittest.mock import patch
from lib.tasks import NotionTaskStore, normalize, validate
from lib import notion
from lib.dining import rank_macro_picks, meal_window


def page(id='11111111-1111-4111-8111-111111111111', source=notion.TASKS, status='Next'):
    return {'id': id, 'parent': {'data_source_id': source}, 'properties': {
        'Task': {'type': 'title', 'title': [{'plain_text': 'Prepare notes'}]},
        'Status': {'type': 'select', 'select': {'name': status}},
        'Focus': {'type': 'checkbox', 'checkbox': True},
        'Deadline': {'type': 'date', 'date': {'start': '2026-09-15T20:30:00-04:00'}},
        'Project': {'type': 'rich_text', 'rich_text': [{'plain_text': 'Exam prep'}]}}}


class Tasks(unittest.TestCase):
    def test_normalized_contract(self):
        result = normalize(page())
        self.assertEqual(result['status'], 'next')
        self.assertEqual(result['project'], 'Exam prep')
        self.assertEqual(result['due'], '2026-09-15T20:30:00-04:00')
        self.assertNotIn('properties', result)

    def test_create_defaults(self):
        with patch('lib.notion.request', return_value=page()) as api:
            NotionTaskStore().create({'name': 'Prepare notes', 'project': 'Exam prep'})
            props = api.call_args.args[2]['properties']
            self.assertTrue(props['Focus']['checkbox'])
            self.assertEqual(props['Status']['select']['name'], 'Next')
            self.assertEqual(props['Project']['rich_text'][0]['text']['content'], 'Exam prep')

    def test_completion_stamps_and_reopen_clears(self):
        store = NotionTaskStore()
        props = store.properties({'status': 'done'}, page())
        self.assertEqual(props['Date Completed']['date']['start'], datetime.now(notion.TZ).date().isoformat())
        self.assertIsNone(store.properties({'status': 'next'}, page(status='Done'))['Date Completed']['date'])

    def test_completion_is_idempotent(self):
        p = page(status='Done')
        p['properties']['Date Completed'] = {'type':'date', 'date':{'start':'2026-09-01'}}
        self.assertNotIn('Date Completed', NotionTaskStore().properties({'status':'done'}, p))

    def test_unrelated_edit_preserves_deadline(self):
        self.assertNotIn('Deadline', NotionTaskStore().properties({'name':'Changed'}))
        self.assertEqual(NotionTaskStore().properties({'due':None})['Deadline'], {'date':None})

    def test_reject_cross_store_write(self):
        with patch('lib.notion.request', return_value=page(source='another-store')) as api:
            with self.assertRaises(ValueError): NotionTaskStore().update({'id':page()['id'], 'focus':False})
            self.assertEqual(api.call_count, 1)

    def test_invalid_inputs(self):
        for data in [{'name':' '}, {'focus':'false'}, {'status':'DELETE'}, {'due':'bad'}, {'name':4}, {'foo':'bar'}]:
            with self.subTest(data=data), self.assertRaises(ValueError): validate(data)


class Dining(unittest.TestCase):
    def test_ranking_exclusions_and_missing_values(self):
        def item(name,p,f=5,na=400):return {'name':name,'protein':p,'fat':f,'sodium':na}
        items=[item('Chicken breast',31,4),item('Chicken thigh',32,10),item('Protein Cookie',50),item('Rice',3),item('Tofu',None),item('Fish',31,4,200)]
        picks=rank_macro_picks(items,10)
        self.assertEqual([i['name'] for i in picks], ['Fish','Chicken breast','Chicken thigh','Tofu'])
        self.assertIsNone(picks[-1]['protein'])

    def test_meal_status_and_overnight(self):
        self.assertIsNone(meal_window({'Status':'Closed','Hours':None},'2026-09-13'))
        start,end=meal_window({'Status':'Open','Hours':{'StartTime':'22:00:00','EndTime':'01:00:00'}},'2026-09-13')
        self.assertEqual((end-start).total_seconds(),10800)


if __name__ == '__main__': unittest.main()
