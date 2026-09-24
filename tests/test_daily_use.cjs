const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const tick=()=>new Promise(r=>setTimeout(r,40)),read=p=>fs.readFileSync(p,'utf8');
let records=[],posts=0,fail=false,saved={};
const base={status:'next',focus:false,planningMode:'automatic',difficulty:'Medium',sourceId:'brightspace:homework',course:'CS 159'};
async function boot(){
 const dom=new JSDOM(read('index.html'),{url:'https://nocean.test',runScripts:'outside-only'}),w=dom.window;
 const RealDate=w.Date;w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-09-22T16:00:00-04:00']));}static now(){return new RealDate('2026-09-22T16:00:00-04:00').getTime();}};
 for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,options={})=>{
  let data={};
  if(url==='/api/tasks'){
   if(options.method==='POST'){posts++;const task={id:'new'+posts,status:'next',...JSON.parse(options.body)};records.push(task);data={task};}
   else if(options.method==='PATCH'){if(fail)return {ok:false,json:async()=>({error:'Test save failure'})};const change=JSON.parse(options.body);records=records.map(t=>t.id===change.id?{...t,...change}:t);data={task:records.find(t=>t.id===change.id)};}
   else data={tasks:structuredClone(records),courses:['CS 159'],statuses:['next','done']};
  }else if(url==='/api/projects')data={projects:[]};
  else if(url==='/api/events')data={events:[{id:'event',name:'Meeting',at:'2026-09-26T15:00:00-04:00'}]};
  else return {ok:false,json:async()=>({error:'Fixture provider unavailable'})};
  return {ok:true,json:async()=>data};
 };
 w.eval(['nocean-shared.js','nocean-data.js','nocean-deadlines.js','nocean-planning.js','calendar-semantics.js','nocean-store.js','nocean-signals.js','nocean-upkeep.js','home.js'].map(read).join('\n'));
 await tick();return {dom,w,$:id=>w.document.getElementById(id)};
}
(async()=>{
 records=[{...base,id:'due',name:'Today assignment',due:'2026-09-22T23:00:00-04:00'}, {...base,id:'up',sourceId:'brightspace:up',name:'Friday assignment',due:'2026-09-25T23:00:00-04:00'}, {...base,id:'old',sourceId:'brightspace:old',name:'Overdue assignment',due:'2026-09-21T23:00:00-04:00'}];
 records.push({...base,id:'historic',name:'Historical completed coursework',status:'done',due:'2026-02-06T23:59:00-05:00'});
 let {dom,w,$}=await boot();
 assert.doesNotMatch($('academicRadar').textContent,/Historical completed coursework/);
 assert.match($('taskList').textContent,/Today assignment/);assert.match($('taskList').textContent,/Overdue assignment/);
 w.document.querySelector('[data-tab="later"]').click();assert.match($('taskList').textContent,/Friday assignment/);
 for(const tab of ['today','tomorrow','later']){
  w.document.querySelector(`[data-tab="${tab}"]`).click();$('taskName').value='Quick '+tab;
  $('quickAdd').dispatchEvent(new w.Event('submit',{cancelable:true}));$('quickAdd').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 }
 assert.equal(posts,3);assert.equal(records.filter(t=>t.name.startsWith('Quick')).length,3);
 w.document.querySelector('[data-tab="later"]').click();w.document.querySelector('[data-edit="up"]').click();
 $('editName').value='Edited Friday assignment';w.document.querySelector('[data-plan="tomorrow"]').click();$('editTask').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(records.find(t=>t.id==='up').due,'2026-09-25T23:00:00-04:00');assert.equal(records.find(t=>t.id==='up').scheduledFor,'2026-09-23');
 w.document.querySelector('[data-tab="today"]').click();const check=w.document.querySelector('[data-complete="due"]');check.checked=true;check.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
 assert.equal(w.document.querySelector('[data-verify="due"]').getAttribute('aria-pressed'),'false');
 $('toast').querySelector('button').click();await tick();assert.equal(records.find(t=>t.id==='due').status,'next');
 const count=Number($('academicRadar').dataset.open);w.document.querySelector('[data-verify="due"]').click();await tick();
 assert.equal(records.find(t=>t.id==='due').status,'done');assert.equal(Number($('academicRadar').dataset.open),count-1);assert.ok(w.document.querySelector('[data-verify="due"]').closest('.is-submitted'));
 assert.equal(w.document.querySelector('[data-calendar-day="2026-09-26"]').dataset.workloadCount,'0');
 assert.ok(w.document.querySelector('[data-calendar-day="2026-09-26"] .calendar-event-dot'));
 for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);saved[k]=w.localStorage.getItem(k);}dom.window.close();
 ({dom,w,$}=await boot());assert.equal(w.document.querySelector('[data-verify="due"]').getAttribute('aria-pressed'),'true');
 w.document.querySelector('[data-tab="tomorrow"]').click();assert.match($('taskList').textContent,/Edited Friday assignment/);
 $('refresh').click();await tick();assert.equal(records.length,7);
 w.document.querySelector('[data-verify="due"]').click();await tick();assert.equal(w.document.querySelector('[data-verify="due"]').getAttribute('aria-pressed'),'false');
 fail=true;w.document.querySelector('[data-verify="up"]').click();await tick();assert.equal(w.document.querySelector('[data-verify="up"]').getAttribute('aria-pressed'),'false');assert.equal(records.find(t=>t.id==='up').status,'next');
 dom.window.close();console.log('Daily-use loop passed: single capture, planning, reload, completion, independent submission, Undo, and failed submission rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
