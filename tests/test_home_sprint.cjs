const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const read=p=>fs.readFileSync(p,'utf8'),tick=()=>new Promise(r=>setTimeout(r,35));
const scripts=['nocean-shared.js','nocean-data.js','nocean-deadlines.js','nocean-planning.js','calendar-semantics.js','nocean-store.js','nocean-signals.js','nocean-upkeep.js'];
(async()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://nocean.test',runScripts:'outside-only'}),w=dom.window,$=s=>w.document.querySelector(s);
 const RealDate=w.Date;w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-09-23T12:00:00-04:00']));}static now(){return new RealDate('2026-09-23T12:00:00-04:00').getTime();}};
 let records=Array.from({length:7},(_,i)=>({id:'t'+i,name:'Assignment '+i,course:'MFET 163',sourceId:'brightspace:'+i,status:'next',focus:false,due:`2026-09-${String(23+i).padStart(2,'0')}T23:59:00-04:00`}));
 const requests=[];
 records[1].due='2026-09-22T23:59:00-04:00';records[1].course='CS 159';records[6].name='Final Exam';
 w.fetch=async(url,options={})=>{
  let data={};
  if(url==='/api/tasks'){
   if(options.method==='PATCH'){const patch=JSON.parse(options.body);requests.push(patch);records=records.map(t=>t.id===patch.id?{...t,...patch}:t);data={task:records.find(t=>t.id===patch.id)};}
   else data={tasks:structuredClone(records),courses:['MFET 163'],statuses:['next','done']};
  }else if(url==='/api/projects')data={projects:[]};
  else if(url==='/api/events')data={events:[{id:'exam',name:'Final Exam',at:'2026-09-29T15:00:00-04:00'},{id:'class',name:'MFET 163 Lecture',type:'Class',at:'2026-09-23T12:45:00-04:00'},{id:'meeting',name:'Weekly club meeting',at:'2026-09-24T12:00:00-04:00'}]};
  else return {ok:false,json:async()=>({error:'Unavailable fixture'})};
  return {ok:true,json:async()=>data};
 };
 w.eval([...scripts,'home.js'].map(read).join('\n')+';window.sprintStore=NOceanStore;');await tick();
 assert.equal(w.document.querySelectorAll('#academicRadar .coursework-item').length,7);
 assert.equal(w.document.querySelectorAll('.class-radar-head').length,0);
 assert.equal(w.document.querySelectorAll('.upkeep-card').length,0);
 $('[data-tab="maintenance"]').click();assert.equal($('#maintenancePane').hidden,false);assert.equal($('#quickAdd').hidden,true);assert.equal($('#taskList').hidden,true);
 $('[data-tab="today"]').click();assert.equal($('#maintenancePane').hidden,true);assert.equal($('#quickAdd').hidden,false);assert($('.tasks-card').classList.contains('workload-outline'));
 const initialCount=Number($('.tasks-card').dataset.workload),box=$('#upkeepDue input');box.checked=true;box.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(Number($('.tasks-card').dataset.workload),initialCount-1);
 $('[data-tab="tomorrow"]').click();assert($('.tasks-card').classList.contains('workload-outline'));
 $('[data-tab="later"]').click();assert.equal($('.tasks-card').classList.contains('workload-outline'),false);
 $('[data-tab="today"]').click();
 assert.match($('#academicRadar .coursework-item').textContent,/Assignment 1/);
 $('#deadlineFilter').value='exams';$('#deadlineFilter').dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('#academicRadar .coursework-item').length,1);assert.match($('#academicRadar').textContent,/Final Exam/);
 $('#deadlineFilter').value='class';$('#deadlineFilter').dispatchEvent(new w.Event('change'));assert.equal($('#deadlineClass').hidden,false);assert.equal(w.document.querySelectorAll('#academicRadar .coursework-item').length,1);assert.match($('#academicRadar').textContent,/CS 159/);
 $('#deadlineFilter').value='all';$('#deadlineFilter').dispatchEvent(new w.Event('change'));
 assert.match($('[data-task-id="t0"] .due-badge').textContent,/DUE TODAY/);
 $('[data-focus="t0"]').click();await tick();assert.equal(records[0].focus,true);assert.equal(requests.at(-1).due,undefined);
 $('[data-tab="later"]').click();$('[data-today="t2"]').click();await tick();
 assert.equal(records[2].scheduledFor,'2026-09-23');assert.equal(records[2].due,'2026-09-25T23:59:00-04:00');assert.equal(requests.at(-1).due,undefined);
 assert.match($('#eventsNext').parentNode.querySelector('.event-name').textContent,/Lecture/);
 assert.match($('#eventsClock').parentNode.textContent,/Final Exam/);assert.doesNotMatch($('#eventsClock').parentNode.textContent,/Lecture|Weekly club/);
 w.eval("sprintStore.saveSettings({dashboard:{showTasks:false,showEvents:false,showHabitat:false,showWeather:false,showDining:false}})");w.dispatchEvent(new w.StorageEvent('storage',{key:'nocean.command.settings.v1'}));await tick();
 assert.equal($('.tasks-card').hidden,true);assert.equal($('#homeSide').hidden,true);assert.equal($('[data-home-module="showWeather"]').hidden,true);assert.equal($('.deadlines-card').hidden,false);
 assert.equal($('.dashboard').style.getPropertyValue('--home-columns'),'minmax(0,1.1fr)');
 dom.window.close();
 const settings=new JSDOM(read('integrations.html'),{url:'https://nocean.test',runScripts:'outside-only'}),v=settings.window;
 v.eval(['nocean-shared.js','nocean-store.js','nocean-dashboard-appearance.js','nocean-ui.js','settings.js'].map(read).join('\n'));
 const swatches=v.document.querySelectorAll('[data-accent]');assert.equal(swatches.length,48);assert.equal(v.document.querySelector('#accentColor').tagName,'DIV');
 for(const key of ['black','eclipse','white','green']){v.document.querySelector(`button[data-accent="${key}"]`).click();assert.equal(JSON.parse(v.localStorage.getItem('nocean.command.settings.v1')).appearance.accent,key);assert.equal(v.document.querySelector(`button[data-accent="${key}"]`).getAttribute('aria-pressed'),'true');}
 const dining=v.document.getElementById('showDining');dining.checked=false;dining.dispatchEvent(new v.Event('change',{bubbles:true}));assert.equal(JSON.parse(v.localStorage.getItem('nocean.command.settings.v1')).dashboard.showDining,false);
 assert.equal(JSON.parse(v.localStorage.getItem('nocean.command.settings.v1')).dashboard.showTasks,true);
 settings.window.close();console.log('Home sprint passed: chronological feed and filters, direct Focus/Today, due badges, event order/significance, layout preferences, and 48 persisted accents.');
})().catch(e=>{console.error(e);process.exitCode=1;});
