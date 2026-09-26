const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const source=name=>fs.readFileSync(name,'utf8'),tick=()=>new Promise(resolve=>setTimeout(resolve,30));
(async()=>{
 const dom=new JSDOM(source('index.html'),{url:'https://nocean.test/',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const result=(data,ok=true)=>Promise.resolve({ok,json:async()=>data});
 let created=null,records=[
   {id:'work',name:'Draft project notes',status:'next',focus:true,planningMode:'planned',scheduledFor:'2026-09-21',due:'2026-09-22',project:'NOcean',difficulty:'Medium'},
   {id:'manual-course',name:'Manual CS notes',course:'CS 159',status:'next',focus:false,planningMode:'planned',scheduledFor:'2026-09-21',priority:'High'},
   {id:'course',sourceId:'brightspace:course',name:'CS 159 Homework',course:'CS 159',status:'next',due:'2026-09-22T23:59:00-04:00'},
   {id:'unmatched',sourceId:'brightspace:unmatched',name:'Feed item without course metadata',course:'',status:'next',due:'2099-09-22T23:59:00-04:00'}
  ];
 w.fetch=async (url,options={})=>{
  url=String(url);
  if(url==='/api/tasks'&&options.method==='POST'){created=JSON.parse(options.body);const task={id:'created',status:'next',...created};records.unshift(task);return result({task});}
  if(url==='/api/tasks'&&options.method==='PATCH'){const change=JSON.parse(options.body);records=records.map(task=>task.id===change.id?{...task,...change}:task);return result({task:records.find(task=>task.id===change.id)});}
  if(url==='/api/tasks')return result({tasks:records,courses:['CS 159'],statuses:['next','done']});
  if(url==='/api/projects')return result({projects:[{id:'p',name:'NOcean',status:'Active'}]});
  if(url==='/api/events')return result({source:'Google Calendar',events:[{id:'e',name:'CS 15900 32224-008',at:'2099-09-21T18:00:00-04:00',type:'Class'},{id:'section',name:'MA 261 Lecture — Section 600',at:'2099-09-21T19:00:00-04:00',type:'Class'},{id:'exam',name:'Exam 2',at:'2099-09-22T18:00:00-04:00',type:'Exam'}]});
  if(url==='/api/recwell')return result({spaces:{},corec_hours:{closed:false,hours:'6 AM–midnight'},aquatic_hours:{closed:false,hours:'6 AM–9 PM'}});
  if(url==='/api/dining')return result({meals:{Lunch:[{name:'Wiley',open:true,start:'2026-09-22T11:00:00-04:00',end:'2026-09-22T14:00:00-04:00',crowd:{percent:24},stations:['Sizzling Pasta Strip'],picks:[{name:'Turkey bowl',protein:31},{name:'Salmon',protein:27},{name:'Tofu',protein:20},{name:'Fourth',protein:19}]},{name:'Windsor',open:true,start:'2026-09-22T11:00:00-04:00',end:'2026-09-22T14:00:00-04:00',crowd:{percent:75},picks:[]},{name:'Ford',open:true,picks:[{name:'Fish',protein:20}]}],Dinner:[]}});
  if(url.startsWith('https://api.open-meteo.com/'))return result({current:{temperature_2m:72,apparent_temperature:70,wind_speed_10m:8,weather_code:1},hourly:{time:[],precipitation_probability:[]},daily:{time:['2026-09-21','2026-09-22'],weather_code:[1,2],temperature_2m_max:[78,75],temperature_2m_min:[55,52]}});
  return result({error:'missing'},false);
 };
 w.eval(['nocean-shared.js','nocean-data.js','nocean-deadlines.js','nocean-planning.js','calendar-semantics.js','nocean-store.js','home.js'].map(source).join('\n'));
 await tick();
 assert.match($('taskList').textContent,/Draft project notes/);assert.match($('taskList').textContent,/Manual CS notes/);assert.doesNotMatch($('taskList').textContent,/CS 159 Homework/);
 assert.match($('academicRadar').textContent,/CS 159 Homework/);assert.doesNotMatch($('academicRadar').textContent,/Draft project notes|Manual CS notes/);
 assert.match($('academicRadar').textContent,/Other coursework/);assert.match($('academicRadar').textContent,/Feed item without course metadata/);
 assert.match($('eventList').textContent,/CS 15900/);assert.doesNotMatch($('eventList').textContent,/32224-008|Section 600/);assert.match($('eventList').textContent,/Exam 2/);assert.match($('eventList').textContent,/\d+d/);assert.ok($('calendarGrid').querySelectorAll('[data-calendar-day]').length>=28);
 $('calendarGrid').querySelector('[data-calendar-day="2026-09-22"]').click();assert.match($('calendarAgenda').textContent,/CS 159 Homework/);assert.match($('calendarAgenda').textContent,/Draft project notes/);
 assert.match($('homeHeading').textContent,/^Good (morning|afternoon|evening), Will$/);assert.ok($('homeSubtitle').textContent.length>5);
 assert.match($('dining').textContent,/Wiley/);assert.match($('dining').textContent,/Windsor/);assert.doesNotMatch($('dining').textContent,/Ford|Fourth/);for(const pick of ['Turkey bowl','Salmon','Tofu'])assert.match($('dining').textContent,new RegExp(pick));assert.match($('dining').textContent,/Sizzling Pasta Strip · available|Protein-forward item unavailable/);assert.match($('weather').textContent,/Feels 70° · Wind 8 mph/);
 w.document.querySelector('[data-tab="tomorrow"]').click();assert.equal($('addButton').textContent,'Add to tomorrow');$('taskName').value='Tomorrow capture';$('taskCourse').value='CS 159';$('taskPriority').value='Critical';$('taskDue').value='2026-10-02';$('quickAdd').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(created.planningMode,'planned');assert.equal(created.focus,false);assert.equal(created.course,'CS 159');assert.equal(created.priority,'Critical');assert.match(created.due,/^2026-10-02T23:59:00/);assert.match($('toast').textContent,/Added to tomorrow/);
 w.document.querySelector('[data-tab="today"]').click();const checkbox=w.document.querySelector('[data-complete="work"]');checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();assert.ok(w.document.querySelector('[data-task-id="work"].done'));assert.match($('toast').textContent,/Task completed/);$('toast').querySelector('button').click();await tick();assert.ok(w.document.querySelector('[data-task-id="work"]:not(.done)'));
 dom.window.close();console.log('Home sketch UI passed: work tasks, trusted deadlines, events, and selected-date calendar remain distinct.');
})().catch(error=>{console.error(error);process.exitCode=1;});
