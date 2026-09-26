// DOM_MODULE=/path/to/jsdom node tests/test_projects_progressive.cjs
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=file=>fs.readFileSync(file,'utf8'),tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const dom=new JSDOM(source('projects.html'),{url:'https://nocean.test/projects.html',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const script of ['nocean-shared.js','nocean-deadlines.js','nocean-filters.js','nocean-planning.js','project-model.js'])vm.runInContext(source(script),dom.getInternalVMContext());
 let releaseTasks;const slowTasks=new Promise(resolve=>{releaseTasks=resolve;});
 w.NOceanData={cache:{peek:()=>null},projects:{list:async()=>({projects:[{id:'p1',name:'Fast selector',status:'Active'}]})},tasks:{list:()=>slowTasks}};
 w.NOceanProjectPlan={mount(){},reset(){},isBusy:()=>false};
 vm.runInContext(source('projects.js'),dom.getInternalVMContext());await tick();
 assert.match($('projectGrid').textContent,/Fast selector/);assert.match($('projectGrid').textContent,/Loading progress/);assert.match($('projectDetail').textContent,/Loading/);
 releaseTasks({tasks:[{id:'t1',name:'Detailed action',status:'next',projectIds:['p1'],planningMode:'planned',scheduledFor:'2099-01-01'}]});await tick();await tick();
 assert.match($('projectDetail').textContent,/Detailed action/);assert.match($('projectStatus').textContent,/up to date/);assert.ok(Number(w.document.body.dataset.projectSelectorReadyAt)>=0);assert.ok(Number(w.document.body.dataset.projectFullReadyAt)>=0);
 dom.window.close();console.log('Projects progressive load passed: selector renders before slow task progress and detail reconciles afterward.');
})().catch(error=>{console.error(error);process.exitCode=1;});
