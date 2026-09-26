const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({Date,Intl});vm.runInContext(fs.readFileSync('nocean-planning.js','utf8'),ctx);const run=s=>vm.runInContext(s,ctx);
ctx.task={taskType:'Multi-step',status:'next',due:'2026-09-26',steps:[{name:'Today',plannedFor:'2026-09-26',done:false},{name:'Tomorrow',plannedFor:'2026-09-27',done:false},{name:'Backlog',plannedFor:null,done:false}]};
assert.equal(run("TaskPlanning.bucket(task,'2026-09-26')"),'today');assert.equal(run("TaskPlanning.relevantSteps(task,'today','2026-09-26').length"),1);assert.equal(run("TaskPlanning.relevantSteps(task,'tomorrow','2026-09-26')[0].name"),'Tomorrow');
ctx.task={taskType:'Multi-step',status:'next',due:'2026-09-26',steps:[{name:'Later',plannedFor:'2026-10-20',done:false}]};assert.equal(run("TaskPlanning.bucket(task,'2026-09-26')"),'today');
ctx.task={taskType:'Multi-step',status:'next',steps:[{plannedFor:'2026-09-26',done:false},{plannedFor:'2026-09-26',done:false}]};assert.equal(run("TaskPlanning.matches(task,'today','2026-09-26')"),true);
assert.equal(run("TaskPlanning.plannedOn(task,'2026-09-26')"),true); // The calendar consumes one parent boolean, not two step rows.
ctx.task={taskType:'Multi-step',status:'next',due:'2026-09-26',steps:[{plannedFor:'2026-09-26',done:false}]};assert.equal(run("TaskPlanning.plannedOn(task,'2026-09-26')"),true); // Deadline + step deduplicate to one parent.
console.log('Multi-step planning passed: step buckets, deadline safety and parent-level visibility.');
