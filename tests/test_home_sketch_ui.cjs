const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const source=name=>fs.readFileSync(name,'utf8'),tick=()=>new Promise(resolve=>setTimeout(resolve,30));
(async()=>{
 const dom=new JSDOM(source('index.html'),{url:'https://nocean.test/',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const result=(data,ok=true)=>Promise.resolve({ok,json:async()=>data});
 let created=null,records=[
   {id:'work',name:'Draft project notes',status:'next',focus:true,planningMode:'planned',scheduledFor:'2026-09-21',due:'2026-09-22',project:'NOcean',difficulty:'Medium'},
   {id:'course',sourceId:'brightspace:course',name:'CS 159 Homework',course:'CS 159',status:'next',due:'2026-09-22T23:59:00-04:00'},
   {id:'unmatched',sourceId:'brightspace:unmatched',name:'Feed item without course metadata',course:'',status:'next',due:'2099-09-22T23:59:00-04:00'}
  ];
 w.fetch=async (url,options={})=>{
  url=String(url);
  if(url==='/api/tasks'&&options.method==='POST'){created=JSON.parse(options.body);const task={id:'created',status:'next',...created};records.unshift(task);return result({task});}
  if(url==='/api/tasks'&&options.method==='PATCH'){const change=JSON.parse(options.body);records=records.map(task=>task.id===change.id?{...task,...change}:task);return result({task:records.find(task=>task.id===change.id)});}
  if(url==='/api/tasks')return result({tasks:records,courses:['CS 159'],statuses:['next','done']});
  if(url==='/api/projects')return result({projects:[{id:'p',name:'NOcean',status:'Active'}]});
  if(url==='/api/events')return result({source:'Google Calendar',events:[{id:'e',name:'ENGR team meeting',at:'2099-09-21T18:00:00-04:00',type:'Other'}]});
  if(url==='/api/recwell')return result({spaces:{},corec_hours:{closed:false,hours:'6 AM–midnight'},aquatic_hours:{closed:false,hours:'6 AM–9 PM'}});
  if(url==='/api/dining')return result({meals:{Lunch:[{name:'Wiley',open:true,start:'2026-09-22T11:00:00-04:00',end:'2026-09-22T14:00:00-04:00',crowd:{percent:24},picks:[{name:'Turkey bowl',protein:31}]},{name:'Windsor',open:true,start:'2026-09-22T11:00:00-04:00',end:'2026-09-22T14:00:00-04:00',crowd:{percent:75},picks:[]},{name:'Ford',open:true,picks:[{name:'Fish',protein:20}]}],Dinner:[{name:'Wiley',open:true,start:'2026-09-22T17:00:00-04:00',end:'2026-09-22T20:00:00-04:00',crowd:{percent:24},picks:[{name:'Turkey bowl',protein:31}]},{name:'Windsor',open:true,start:'2026-09-22T17:00:00-04:00',end:'2026-09-22T20:00:00-04:00',crowd:{percent:75},picks:[]},{name:'Ford',open:true,picks:[{name:'Fish',protein:20}]}]}});
  if(url.startsWith('https://api.open-meteo.com/'))return result({current:{temperature_2m:72,weather_code:1},hourly:{time:[],precipitation_probability:[]},daily:{time:['2026-09-21','2026-09-22'],weather_code:[1,2],temperature_2m_max:[78,75],temperature_2m_min:[55,52]}});
  return result({error:'missing'},false);
 };
 w.eval(['nocean-shared.js','nocean-data.js','nocean-deadlines.js','nocean-planning.js','calendar-semantics.js','nocean-store.js','home.js'].map(source).join('\n'));
 await tick();
 assert.match($('taskList').textContent,/Draft project notes/);assert.match($('taskList').textContent,/CS 159 Homework/);
 assert.match($('academicRadar').textContent,/CS 159 Homework/);assert.doesNotMatch($('academicRadar').textContent,/Draft project notes/);
 assert.match($('academicRadar').textContent,/Other coursework/);assert.match($('academicRadar').textContent,/Feed item without course metadata/);
 assert.match($('eventList').textContent,/ENGR team meeting/);assert.ok($('calendarGrid').querySelectorAll('[data-calendar-day]').length>=28);
 $('calendarGrid').querySelector('[data-calendar-day="2026-09-22"]').click();assert.match($('calendarAgenda').textContent,/CS 159 Homework/);assert.match($('calendarAgenda').textContent,/Draft project notes/);
 assert.match($('homeHeading').textContent,/^Good (morning|afternoon|evening), Will$/);assert.ok($('homeSubtitle').textContent.length>5);
 assert.match($('dining').textContent,/Wiley/);assert.match($('dining').textContent,/Windsor/);assert.doesNotMatch($('dining').textContent,/Ford/);assert.match($('dining').textContent,/Turkey bowl/);assert.match($('dining').textContent,/Protein-forward item unavailable/);
 w.document.querySelector('[data-tab="tomorrow"]').click();assert.equal($('addButton').textContent,'Add to tomorrow');$('taskName').value='Tomorrow capture';$('taskDue').value='2026-10-02';$('quickAdd').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(created.planningMode,'planned');assert.equal(created.focus,false);assert.match(created.due,/^2026-10-02T23:59:00/);assert.match($('toast').textContent,/Added to tomorrow/);
 w.document.querySelector('[data-tab="today"]').click();const checkbox=w.document.querySelector('[data-complete="work"]');checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();assert.ok(w.document.querySelector('[data-task-id="work"].done'));assert.match($('toast').textContent,/Task completed/);$('toast').querySelector('button').click();await tick();assert.ok(w.document.querySelector('[data-task-id="work"]:not(.done)'));
 dom.window.close();console.log('Home sketch UI passed: work tasks, trusted deadlines, events, and selected-date calendar remain distinct.');
})().catch(error=>{console.error(error);process.exitCode=1;});
