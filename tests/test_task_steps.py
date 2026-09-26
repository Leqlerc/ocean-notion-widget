import unittest
from unittest.mock import patch
from lib.task_steps import TaskStepStore, block_payload, normalize, validate

TASK='11111111-1111-4111-8111-111111111111'
KEY='22222222-2222-4222-8222-222222222222'
BLOCK='33333333-3333-4333-8333-333333333333'
DATA={'taskId':TASK,'requestId':KEY,'name':'Draft solution','plannedFor':'2026-10-01','done':False}

def block(data=DATA):
 return {**block_payload(data),'id':BLOCK,'last_edited_time':'2026-09-26T00:00:00Z'}

class TaskStepTests(unittest.TestCase):
 def test_tagged_native_todo_and_unrelated_blocks(self):
  step=normalize(block());self.assertEqual(step['requestId'],KEY);self.assertEqual(step['plannedFor'],'2026-10-01')
  self.assertIsNone(normalize({'id':'other','type':'to_do','to_do':{'rich_text':[{'type':'text','text':{'content':'Private note'}}]}}))
 def test_validation(self):
  self.assertIsNone(validate({**DATA,'plannedFor':None})['plannedFor'])
  for bad in ({**DATA,'name':''},{**DATA,'plannedFor':'bad'},{**DATA,'done':'yes'},{**DATA,'unknown':1}):
   with self.assertRaises((ValueError,TypeError)):validate(bad)
 def test_parent_ownership_and_import_refusal(self):
  store=TaskStepStore()
  with patch('lib.tasks.NotionTaskStore.owned_page',return_value={'id':TASK,'properties':{}}):
   with self.assertRaises(ValueError):store.parent(TASK)
  page={'id':TASK,'properties':{'Task Type':{'type':'select','select':{'name':'Multi-step'}},'Source ID':{'type':'rich_text','rich_text':[{'plain_text':'brightspace:x'}]}}}
  with patch('lib.tasks.NotionTaskStore.owned_page',return_value=page):
   with self.assertRaises(ValueError):store.parent(TASK)
 def test_update_requires_owned_step_and_conflict_token(self):
  store=TaskStepStore();old=normalize(block())
  with patch.object(store,'parent',return_value={'id':TASK}),patch.object(store,'list_for_page',return_value=[old]):
   with self.assertRaises(ValueError):store.update({**old,'taskId':TASK,'editedAt':'stale'})
  with patch.object(store,'parent',return_value={'id':TASK}),patch.object(store,'list_for_page',return_value=[]),patch('lib.task_steps.notion.request') as request:
   with self.assertRaises(ValueError):store.remove({'taskId':TASK,'id':BLOCK,'editedAt':old['editedAt']})
   request.assert_not_called()
 def test_parent_completion_semantics(self):
  store=TaskStepStore();done={**normalize(block()),'done':True}
  page={'id':TASK,'properties':{'Status':{'type':'select','select':{'name':'Next'}}}}
  with patch.object(store,'list_for_page',return_value=[done]),patch('lib.tasks.NotionTaskStore.owned_page',return_value=page),patch('lib.task_steps.notion.request',return_value=page) as request:
   self.assertEqual(store.sync_parent(TASK)['status'],'done');self.assertEqual(request.call_args.args[2]['properties']['Status']['select']['name'],'Done')
  reopened={'id':TASK,'properties':{'Status':{'type':'select','select':{'name':'Done'}},'Date Completed':{'type':'date','date':{'start':'2026-09-26'}}}}
  with patch.object(store,'list_for_page',return_value=[normalize(block())]),patch('lib.tasks.NotionTaskStore.owned_page',return_value=reopened),patch('lib.task_steps.notion.request',return_value=reopened) as request:
   self.assertEqual(store.sync_parent(TASK)['status'],'next');self.assertEqual(request.call_args.args[2]['properties']['Status']['select']['name'],'Next')

if __name__=='__main__':unittest.main()
