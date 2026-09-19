const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({Date,Intl,URLSearchParams});
for(const file of ['nocean-deadlines.js','nocean-filters.js','nocean-planning.js','project-model.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
const project={id:'p1',name:'Pull-ups',status:'Active'};
const tasks=[
 {id:'one',name:'Backlog overdue',projectIds:['p1'],due:'2026-09-18',planningMode:'backlog'},
 {id:'two',name:'Tomorrow',projectIds:['p1'],scheduledFor:'2026-09-20'},
 {id:'three',name:'Rolled over',projectIds:['p1'],scheduledFor:'2026-09-18'},
 {id:'four',name:'Done',project:'Pull-ups',status:'done'},
 {id:'five',name:'Unrelated',projectIds:['p2'],project:'Pull-ups'},
];
const original=JSON.stringify(tasks);
ctx.project=project;ctx.tasks=tasks;
const summary=run("ProjectModel.summarize(project,tasks,new Date('2026-09-19T12:00:00'))");
assert.equal(summary.related.length,4);assert.equal(summary.done,1);assert.equal(summary.percent,25);
assert.equal(summary.today,1);assert.equal(summary.tomorrow,1);assert.equal(summary.overdue,1);
assert.equal(JSON.stringify(summary.next.map(t=>t.id)),JSON.stringify(['three','two','one']));
assert.equal(JSON.stringify(tasks),original);
assert.equal(run('ProjectModel.summarize(project,[]).percent'),null);
assert.equal(run("ProjectModel.summarize(project,[{name:'Done',projectIds:['p1'],status:'done'}]).percent"),100);
assert.equal(project.status,'Active'); // Never auto-complete the project from task totals.
assert.equal(run("ProjectModel.taskURL('p1','a&b')"),'/tasks.html?project=p1&view=all&task=a%26b');
console.log('Project model passed: relation identity, explicit deferral, task-only progress, stable inputs and task links.');
