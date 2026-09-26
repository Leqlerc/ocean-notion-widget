// DOM_MODULE=/path/to/jsdom node tests/test_task_interactions.cjs
// Full existing Tasks script against a disposable API fixture. Not a live persistence/layout test.
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const clone=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(r=>setImmediate(r));
const fixedNow=new Date('2026-09-20T12:00:00').getTime();
class TestDate extends Date {constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return fixedNow;}}
const deadline='2026-09-21T15:30:00-04:00';
let records=[
 {id:'today',name:'Today action',scheduledFor:'2026-09-20',planningMode:'planned',due:deadline},
 {id:'tomorrow',name:'Deferred action',scheduledFor:'2026-09-21',planningMode:'planned',due:'2026-09-19T15:30:00-04:00'},
 {id:'upcoming',name:'Upcoming action',scheduledFor:'2026-09-25',planningMode:'planned'},
 {id:'backlog',name:'Backlog action',planningMode:'backlog',due:'2026-09-21T23:59:00-04:00'},
 {id:'distant',name:'Distant action',planningMode:'automatic',due:'2026-10-25T23:59:00-04:00'},
 ].map(t=>({status:'next',taskType:'Simple',priority:'Normal',steps:[],projectIds:['p1'],project:'Project',focus:false,...t}));
let writes=[],fail=false,created=0;
const api={
 projects:{list:async()=>({projects:[{id:'p1',name:'Project',status:'Active'}]})},
 tasks:{
  list:async()=>({tasks:clone(records)}),
  create:async data=>{if(fail)throw Error('Fixture save failed');const task={...clone(data),id:'new'+(++created),status:'next',projectIds:data.projectId?[data.projectId]:[]};records.push(task);return {task:clone(task)};},
  update:async data=>{writes.push(clone(data));if(fail)throw Error('Fixture save failed');records=records.map(t=>t.id===data.id?{...t,...clone(data),...('status' in data?{doneDate:data.status==='done'?'2026-09-20T12:00:00Z':null}:{})}:t);return {task:clone(records.find(t=>t.id===data.id))};},
  archive:async id=>{if(fail)throw Error('Fixture archive failed');records=records.filter(t=>t.id!==id);return {id,archived:true};}
 }
};
async function boot(){
 const dom=new JSDOM(fs.readFileSync('tasks.html','utf8'),{url:'https://nocean.test/tasks.html',runScripts:'outside-only'});
 const w=dom.window;w.Date=TestDate;w.NOceanData=api;w.NOceanIcons={slot:()=>''};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const file of ['nocean-shared.js','nocean-deadlines.js','nocean-filters.js','nocean-planning.js','tasks.js'])vm.runInContext(fs.readFileSync(file,'utf8'),dom.getInternalVMContext());
 await tick();return dom;
}
(async()=>{
 let dom=await boot();
 try{
  let w=dom.window,$=id=>w.document.getElementById(id);
  const view=async key=>{w.document.querySelector(`[data-view="${key}"]`).click();await tick();};
  assert.match($('moduleTasks').textContent,/Today action/);assert.doesNotMatch($('moduleTasks').textContent,/Deferred action/);
  await view('tomorrow');assert.match($('moduleTasks').textContent,/Deferred action/);
  await view('upcoming');assert.match($('moduleTasks').textContent,/Upcoming action/);assert.doesNotMatch($('moduleTasks').textContent,/Distant action/);
  await view('later');assert.match($('moduleTasks').textContent,/Backlog action/);assert.match($('moduleTasks').textContent,/Distant action/);
  await view('today');w.document.querySelector('[data-task="today"][data-plan="tomorrow"]').click();await tick();
  assert.equal(records.find(t=>t.id==='today').scheduledFor,'2026-09-21');assert.equal(records.find(t=>t.id==='today').due,deadline);
  assert.ok(!('due' in writes.at(-1)));
  // Fresh page state must load the changed plan from the fixture, not retain a UI-only change.
  dom.window.close();dom=await boot();w=dom.window;$=id=>w.document.getElementById(id);
  await view('tomorrow');assert.match($('moduleTasks').textContent,/Today action/);
  w.document.querySelector('[data-task="today"][data-plan="later"]').click();await tick();
  assert.equal(records.find(t=>t.id==='today').planningMode,'backlog');assert.equal(records.find(t=>t.id==='today').due,deadline);
  await view('later');w.document.querySelector('[data-task="today"][data-plan="today"]').click();await tick();
  await view('today');w.document.querySelector('[data-edit="today"]').click();
   $('editName').value='Edited action';$('editPriority').value='High';
  $('editForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(records.find(t=>t.id==='today').name,'Edited action');assert.equal(records.find(t=>t.id==='today').due,deadline);
  assert.ok(!('due' in writes.at(-1)));assert.equal($('taskEditor').open,false);
  let checkbox=w.document.querySelector('[data-complete="today"]');checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
  assert.equal(records.find(t=>t.id==='today').status,'done');assert.ok(records.find(t=>t.id==='today').doneDate);
  $('moduleToast').querySelector('button').click();await tick();
  assert.equal(records.find(t=>t.id==='today').status,'next');assert.equal(records.find(t=>t.id==='today').doneDate,null);
  assert.equal(records.find(t=>t.id==='today').due,deadline);
  // Failed plan saves must restore the old state, with no disappearing task.
  fail=true;w.document.querySelector('[data-task="today"][data-plan="tomorrow"]').click();await tick();
  assert.equal(records.find(t=>t.id==='today').scheduledFor,'2026-09-20');assert.match($('moduleTasks').textContent,/Edited action/);fail=false;
  $('taskName').value='Date only capture';$('captureDue').value='2026-09-26';$('captureTime').value='';
  $('capture').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.match(records.find(t=>t.id==='new1').due,/^2026-09-26T23:59:00[+-]\d\d:\d\d$/);
  w.document.querySelector('[data-edit="new1"]').click();fail=true;$('archiveTask').click();await tick();
  assert.ok(records.some(t=>t.id==='new1'));assert.equal($('taskEditor').open,true);assert.match($('editError').textContent,/archive failed/);
  fail=false;$('archiveTask').click();await tick();assert.ok(!records.some(t=>t.id==='new1'));assert.equal($('taskEditor').open,false);
  $('refresh').click();await tick();assert.doesNotMatch($('moduleTasks').textContent,/Date only capture/);
  assert.equal(records.find(t=>t.id==='today').due,deadline);
  console.log('Tasks DOM regression passed: all queues, fresh-page reload, plan moves, edit, completion/Undo, failure rollback, archive and unchanged/default deadlines.');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
