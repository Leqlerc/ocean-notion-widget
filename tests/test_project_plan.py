import unittest
from unittest.mock import patch
from lib.project_plan import ProjectPlanStore,block_payload,normalize,validate

PROJECT='11111111-1111-4111-8111-111111111111'
KEY='22222222-2222-4222-8222-222222222222'
BLOCK='33333333-3333-4333-8333-333333333333'
DATA={'projectId':PROJECT,'requestId':KEY,'kind':'milestone','text':'Reach baseline','due':'2026-10-01','done':False}
def block(data=DATA):
 return {**block_payload(data),'id':BLOCK,'last_edited_time':'2026-09-20T00:00:00Z'}

class ProjectPlanTests(unittest.TestCase):
 def test_native_checkbox_date_and_unmarked_notes(self):
  value=normalize(block());self.assertEqual(value['due'],'2026-10-01');self.assertEqual(value['requestId'],KEY)
  self.assertIsNone(normalize({'type':'paragraph','paragraph':{'rich_text':[{'text':{'content':'Private existing note'}}]}}))
  self.assertIsNone(normalize({**block(),'in_trash':True}))
 def test_create_then_retry(self):
  store=ProjectPlanStore()
  with patch.object(store,'list',return_value={'items':[]}),patch('lib.project_plan.notion.request',return_value={'results':[block()]}) as request:
   self.assertEqual(store.create(DATA)['item']['id'],BLOCK);self.assertEqual(request.call_args.args[0],'PATCH')
  with patch.object(store,'list',return_value={'items':[normalize(block())]}),patch('lib.project_plan.notion.request') as request:
   self.assertEqual(store.create(DATA)['item']['id'],BLOCK);request.assert_not_called()
   with self.assertRaises(ValueError):store.create({**DATA,'text':'Different request'})
 def test_update_completion_and_cross_project_refusal(self):
  store=ProjectPlanStore();old=normalize(block())
  with patch.object(store,'list',return_value={'items':[old]}),patch('lib.project_plan.notion.request',return_value=block({**DATA,'done':True})) as request:
   result=store.update({**old,'projectId':PROJECT,'done':True})
   self.assertTrue(result['item']['done']);self.assertEqual(request.call_args.args[2]['to_do']['checked'],True)
   with self.assertRaises(ValueError):store.update({**old,'projectId':PROJECT,'editedAt':'old'})
  with patch.object(store,'list',return_value={'items':[]}),patch('lib.project_plan.notion.request') as request:
   with self.assertRaises(ValueError):store.update({**old,'projectId':PROJECT,'done':True})
   request.assert_not_called()
 def test_list_checks_project_and_paginates(self):
  store=ProjectPlanStore()
  with patch('lib.project_plan.NotionProjectStore.owned',return_value={'id':PROJECT}) as owned,patch('lib.project_plan.notion.request',side_effect=[{'results':[],'has_more':True,'next_cursor':'next'},{'results':[block()],'has_more':False}]):
   self.assertEqual(len(store.list(PROJECT)['items']),1);owned.assert_called_once_with(PROJECT)
 def test_remove_only_managed_block(self):
  store=ProjectPlanStore();old=normalize(block())
  with patch.object(store,'list',return_value={'items':[old]}),patch('lib.project_plan.notion.request') as request:
   store.update({'projectId':PROJECT,'id':BLOCK,'editedAt':old['editedAt'],'action':'remove'})
   self.assertEqual(request.call_args.args[2],{'in_trash':True})
 def test_validate(self):
  for data in ({**DATA,'due':'bad'},{**DATA,'kind':'objective'},{**DATA,'text':''},{**DATA,'unknown':1}):
   with self.assertRaises(ValueError):validate(data)

if __name__=='__main__':unittest.main()
