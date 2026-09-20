// DOM_MODULE=/path/to/jsdom node tests/test_project_interactions.cjs
// Exercises the actual page scripts with an in-memory API fixture; no real records are changed.
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=file=>fs.readFileSync(file,'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const project={id:'p1',name:'Pull-up progression',status:'Active',due:'2026-12-01',url:'https://www.notion.so/p1',taskIds:['t1']};
const task={id:'t1',name:'Baseline test',status:'next',projectIds:['p1'],project:project.name,due:'2026-09-21T15:30:00-04:00',difficulty:'Medium',planningMode:'planned',scheduledFor:'2026-09-20'};

function page(file,url){
 const dom=new JSDOM(source(file),{url,runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const script of ['nocean-shared.js','nocean-deadlines.js','nocean-filters.js','nocean-planning.js'])vm.runInContext(source(script),dom.getInternalVMContext());
 return dom;
}

(async()=>{
 const dom=page('projects.html','https://nocean.test/projects.html');const w=dom.window,$=id=>w.document.getElementById(id);
 let records=[clone(project)],fail=false,hold=null,updates=[];
 w.NOceanData={projects:{
  list:()=>hold?hold:Promise.resolve({projects:clone(records)}),
  create:async data=>{if(fail)throw Error('Save unavailable');const p={...data,id:'p2',status:'Active',taskIds:[]};records.push(p);return {project:clone(p)};},
  update:async data=>{updates.push(clone(data));if(fail)throw Error('Save unavailable');records=records.map(p=>p.id===data.id?{...p,...data}:p);return {project:clone(records.find(p=>p.id===data.id))};}
 },tasks:{list:async()=>({tasks:[clone(task)]})}};
 vm.runInContext(source('project-model.js'),dom.getInternalVMContext());vm.runInContext(source('projects.js'),dom.getInternalVMContext());await tick();
 try{
  assert.match($('projectGrid').textContent,/Pull-up progression/);
  $('projectSearch').value='unknown';$('projectSearch').dispatchEvent(new w.Event('input'));assert.match($('projectGrid').textContent,/No matching/);
  $('projectSearch').value='';$('projectSearch').dispatchEvent(new w.Event('input'));
  w.location.hash='p1';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await tick();
  assert.equal($('projectIndex').hidden,true);assert.match($('projectDetail').textContent,/Baseline test/);
  assert.match($('projectDetail').innerHTML,/tasks.html\?project=p1&amp;view=all&amp;task=t1/);
  $('editProject').click();$('projectDue').value='2027-01-18';$('projectLifecycle').value='Completed';
  fail=true;$('projectForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal($('projectEditor').open,true);assert.match($('projectError').textContent,/Save unavailable/);
  assert.equal(records[0].status,'Active');assert.equal($('projectDue').value,'2027-01-18');
  fail=false;$('projectForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal($('projectEditor').open,false);assert.equal(records[0].status,'Completed');
  assert.equal(updates.at(-1).due,'2027-01-18');assert.match($('projectDetail').textContent,/Baseline test/);
  $('refresh').click();await tick();assert.match($('projectDetail').textContent,/Completed/);
  // A slow read started before a save must not overwrite the saved lifecycle.
  let resolve;hold=new Promise(r=>resolve=r);$('refresh').click();
  $('editProject').click();$('projectLifecycle').value='Active';$('projectForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  resolve({projects:[{...project,status:'Completed'}]});hold=null;await tick();
  assert.equal(records[0].status,'Active');assert.match($('projectDetail').textContent,/Active/);
  w.location.hash='missing';w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.match($('projectDetail').textContent,/Project unavailable/);
  w.location.hash='';w.dispatchEvent(new w.HashChangeEvent('hashchange'));$('newProject').click();
  $('projectName').value='   ';$('projectForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.match($('projectError').textContent,/Enter a project name/);
  $('projectName').value='Second goal';$('projectForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(w.location.hash,'#p2');assert.match($('projectDetail').textContent,/No tasks yet/);
  assert.equal(records.length,2);assert.equal(task.due,'2026-09-21T15:30:00-04:00');
 }finally{dom.window.close();}
 const td=page('tasks.html','https://nocean.test/tasks.html?project=p1&view=all&task=t1');
 try{
  const t=td.window;
  t.NOceanData={tasks:{list:async()=>({tasks:[clone(task)]})},projects:{list:async()=>({projects:[clone(project)]})}};
  t.NOceanIcons={slot:()=>''};vm.runInContext(source('tasks.js'),td.getInternalVMContext());await tick();
  const get=id=>t.document.getElementById(id);
  assert.equal(get('projectFilter').value,'p1');assert.equal(get('captureProject').value,'p1');
  assert.equal(get('taskEditor').open,true);assert.equal(get('editId').value,'t1');
  assert.equal(get('editDue').value,'2026-09-21');assert.equal(get('editTime').value,get('editTime').dataset.original);
  assert.match(get('viewHint').textContent,/All current tasks/);
  get('cancelEdit').click();get('refresh').click();await tick();assert.equal(get('taskEditor').open,false);
 }finally{td.window.close();}
 console.log('Project interactions passed: search, detail, create, persisted-state reload, save failure, stale-read guard, missing ID, scoped task editor and capture.');
})().catch(e=>{console.error(e);process.exitCode=1;});
