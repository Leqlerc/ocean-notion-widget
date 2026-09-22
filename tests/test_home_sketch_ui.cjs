const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const source=name=>fs.readFileSync(name,'utf8'),tick=()=>new Promise(resolve=>setTimeout(resolve,30));
(async()=>{
 const dom=new JSDOM(source('index.html'),{url:'https://nocean.test/',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const result=(data,ok=true)=>Promise.resolve({ok,json:async()=>data});
 w.fetch=async url=>{
  url=String(url);
  if(url==='/api/tasks')return result({tasks:[
   {id:'work',name:'Draft project notes',status:'next',focus:true,planningMode:'planned',scheduledFor:'2026-09-21',due:'2026-09-22',project:'NOcean',difficulty:'Medium'},
   {id:'course',sourceId:'brightspace:course',name:'CS 159 Homework',course:'CS 159',status:'next',due:'2026-09-22T23:59:00-04:00'},
   {id:'unmatched',sourceId:'brightspace:unmatched',name:'Feed item without course metadata',course:'',status:'next',due:'2099-09-22T23:59:00-04:00'}
  ],courses:['CS 159'],statuses:['next','done']});
  if(url==='/api/projects')return result({projects:[{id:'p',name:'NOcean',status:'Active'}]});
  if(url==='/api/events')return result({source:'Google Calendar',events:[{id:'e',name:'ENGR team meeting',at:'2099-09-21T18:00:00-04:00',type:'Other'}]});
  if(url==='/api/recwell')return result({spaces:{},corec_hours:{closed:false,hours:'6 AM–midnight'},aquatic_hours:{closed:false,hours:'6 AM–9 PM'}});
  if(url==='/api/dining')return result({meals:{Dinner:[]}});
  if(url.startsWith('https://api.open-meteo.com/'))return result({current:{temperature_2m:72,weather_code:1},hourly:{time:[],precipitation_probability:[]},daily:{time:['2026-09-21','2026-09-22'],weather_code:[1,2],temperature_2m_max:[78,75],temperature_2m_min:[55,52]}});
  return result({error:'missing'},false);
 };
 w.eval(['nocean-shared.js','nocean-data.js','nocean-deadlines.js','nocean-planning.js','calendar-semantics.js','nocean-store.js','home.js'].map(source).join('\n'));
 await tick();
 assert.match($('taskList').textContent,/Draft project notes/);assert.doesNotMatch($('taskList').textContent,/CS 159 Homework/);
 assert.match($('academicRadar').textContent,/CS 159 Homework/);assert.doesNotMatch($('academicRadar').textContent,/Draft project notes/);
 assert.match($('academicRadar').textContent,/Other coursework/);assert.match($('academicRadar').textContent,/Feed item without course metadata/);
 assert.match($('eventList').textContent,/ENGR team meeting/);assert.ok($('calendarGrid').querySelectorAll('[data-calendar-day]').length>=28);
 $('calendarGrid').querySelector('[data-calendar-day="2026-09-22"]').click();assert.match($('calendarAgenda').textContent,/CS 159 Homework/);assert.match($('calendarAgenda').textContent,/Draft project notes/);
 dom.window.close();console.log('Home sketch UI passed: work tasks, trusted deadlines, events, and selected-date calendar remain distinct.');
})().catch(error=>{console.error(error);process.exitCode=1;});
