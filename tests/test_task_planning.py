import unittest
from lib.tasks import validate,NotionTaskStore,normalize
class Planning(unittest.TestCase):
 def test_plan_write_does_not_change_deadline(self):
  payload=validate({'planningMode':'planned','scheduledFor':'2026-09-20','focus':False})
  props=NotionTaskStore().properties(payload)
  self.assertNotIn('Deadline',props);self.assertEqual(props['Do date']['date']['start'],'2026-09-20');self.assertEqual(props['Planning Mode']['select']['name'],'Planned')
 def test_invalid_plan_rejected(self):
  for value in [True,'2026-02-31','2026-09-20T12:00:00']:
   with self.assertRaises(ValueError):validate({'scheduledFor':value})
  with self.assertRaises(ValueError):validate({'planningMode':'planned'})
  with self.assertRaises(ValueError):validate({'planningMode':'backlog','scheduledFor':'2026-09-20'})
 def test_backlog_clears_plan_not_due(self):
  props=NotionTaskStore().properties(validate({'planningMode':'backlog','scheduledFor':None,'focus':False}))
  self.assertEqual(props['Do date'],{'date':None});self.assertNotIn('Deadline',props)
 def test_missing_mode_backward_compatible(self):
  self.assertEqual(normalize({'id':'x','properties':{}})['planningMode'],'automatic')
