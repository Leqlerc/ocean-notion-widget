import unittest
from unittest.mock import patch
from datetime import datetime,timedelta
from lib.dining import court_menu,meal_group,wait_report,load_crowds,TZ,rank_macro_picks,hall_score
class Meals(unittest.TestCase):
 def test_breakfast_excluded_late_lunch_separate(self):
  def meal(name,start,end,item):return {'Name':name,'Type':name,'Status':'Open','Hours':{'StartTime':start,'EndTime':end},'Stations':[{'Name':'Rotating Grill','Items':[{'ID':item,'Name':'Chicken '+item}]}]}
  menu={'IsPublished':True,'Meals':[meal('Breakfast','07:00:00','10:00:00','breakfast'),meal('Lunch','11:00:00','14:00:00','lunch'),meal('Late Lunch','14:00:00','16:00:00','late'),meal('Dinner','17:00:00','21:00:00','dinner')]}
  with patch('lib.dining.fetch',return_value=menu):
   result=court_menu('Ford',datetime(2026,9,15,15,tzinfo=TZ));self.assertEqual(set(result),{'Lunch','Dinner'});self.assertEqual(result['Lunch'][1][0]['ID'],'late');self.assertEqual(result['Dinner'][1][0]['ID'],'dinner')
 def test_wait_freshness_and_colors(self):
  now=datetime(2026,9,15,12,tzinfo=TZ)
  for maximum,level in [(5,'low'),(10,'moderate'),(20,'busy'),(25,'very-busy')]:
   r={'LastUpdated':now.isoformat(),'ShortLoadDescription':f'Estimated wait: 0-{maximum} minutes'}
   self.assertEqual(wait_report(r,now)['level'],level);self.assertIsNone(wait_report(r,now+timedelta(minutes=16)))
 def test_crowd_failure_is_unknown(self):
  with patch('lib.dining.fetch',side_effect=RuntimeError('down')):
   self.assertTrue(all(not c['available'] for c in load_crowds(datetime.now(TZ)).values()))
 def test_rotating_beats_staple_and_protein_beats_ratio(self):
  def item(name,p,f,rotating):return {'name':name,'protein':p,'fat':f,'rotating':rotating}
  picks=rank_macro_picks([item('Grilled Chicken Breast',50,1,False),item('Turkey Meatballs',30,10,True),item('Fish',20,1,True)])
  self.assertEqual([p['name'] for p in picks],['Turkey Meatballs','Fish','Grilled Chicken Breast'])

 def test_hall_order_uses_food_not_crowds(self):
  courts=[{'name':'Alpha','picks':[{'name':'Fish','protein':20,'fat':1,'rotating':True}],'crowd':{'level':'low'}},{'name':'Zulu','picks':[{'name':'Chicken','protein':35,'fat':10,'rotating':True}],'crowd':{'level':'very-busy'}},{'name':'Empty','picks':[]}]
  self.assertEqual([c['name'] for c in sorted(courts,key=hall_score)],['Zulu','Alpha','Empty'])
