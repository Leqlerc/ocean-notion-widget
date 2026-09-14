const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('nocean.js','utf8').split("$('quickAdd').addEventListener")[0];
const elements = new Map();
const context = vm.createContext({Intl,Date,Set,Map,URL,AbortController,setTimeout,clearTimeout,
  document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}}});
vm.runInContext(readFileSync('nocean-shared.js','utf8') + '\n' + readFileSync('nocean-deadlines.js','utf8') + '\n' + readFileSync('calendar-semantics.js','utf8') + '\n' + source, context);
const run = s=>vm.runInContext(s,context);
run(`state.projects=[{id:'p',name:'Exam',status:'Active'},{id:'zero',name:'Zero',status:'Active'}];state.tasks=[
 {id:'1',name:'Later',project:'Exam',status:'next',focus:true,due:'2099-01-01'},
 {id:'2',name:'In progress',project:'Exam',status:'doing',focus:false,due:null},
 {id:'3',name:'Done',project:'Exam',status:'done',completedOn:dayKey()},
 {id:'4',name:'Overdue',project:'',status:'next',focus:false,due:'2020-01-01'}];`);
assert.equal(run('deriveProjects(state.tasks)[0].next.id'),'2');
assert.equal(run('deriveProjects(state.tasks)[0].count'),2);
assert.equal(run('deriveProjects(state.tasks).find(p=>p.id===\"p\").percent'),33);
assert.equal(run('deriveProjects(state.tasks).find(p=>p.id===\"zero\").percent'),0);
assert.equal(run('deriveProjects(state.tasks.map(t=>({...t,status:\"done\"}))).find(p=>p.id===\"p\").percent'),100);
assert.equal(run('deriveProjects(state.tasks,[{id:\"p\",name:\"Exam\",status:\"Completed\"}]).length'),0);
assert.equal(run('visibleTasks().length'),3);
run('state.showDone=true');assert.equal(run('visibleTasks().length'),4);
assert.equal(run(`routineEvent({type:'Class',name:'MA 261 Quiz'})`),false);
assert.equal(run(`routineEvent({type:'Class',name:'MA 261 Lecture'})`),true);
assert.equal(run(`eventOnDay({at:'2026-09-13',end:'2026-09-15',exclusiveEnd:true},'2026-09-15')`),false);
assert.equal(run(`eventOnDay({at:'2026-09-13',end:'2026-09-15',exclusiveEnd:true},'2026-09-14')`),true);
assert.equal(run(`safeURL('javascript:alert(1)')`),'');
assert.equal(run(`esc('<script>')`),'&lt;script&gt;');
(async()=>{
  run(`renderTasks=()=>{}; toast=()=>{}; TaskStore.update=async()=>{throw new Error('offline')};`);
  assert.equal(await run(`updateTask('1',{status:'done'})`),false);
  assert.equal(run(`state.tasks.find(t=>t.id==='1').status`),'next');
  assert.equal(run('state.pending.size'),0);
  run(`TaskStore.update=async task=>({task:{...state.tasks.find(t=>t.id===task.id),...task}});`);
  assert.equal(await run(`updateTask('1',{focus:false})`),true);
  assert.equal(run(`state.tasks.find(t=>t.id==='1').focus`),false);
  console.log('Frontend contracts passed: project priority, Today, done dates, event filtering, escaping, save rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
