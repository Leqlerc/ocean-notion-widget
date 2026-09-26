const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const c=vm.createContext({Intl,Date});vm.runInContext(fs.readFileSync('nocean-planning.js','utf8'),c);const run=s=>vm.runInContext(s,c);
const today='2026-09-19';
for(const [task,wanted] of [[{due:'2026-09-18',scheduledFor:'2026-09-20',planningMode:'planned',focus:true},'tomorrow'],[{due:'2026-09-18',planningMode:'backlog'},'later'],[{scheduledFor:'2026-09-18'},'today'],[{due:'2026-09-20'},'tomorrow'],[{due:'2026-09-21'},'upcoming'],[{due:'2026-10-03'},'upcoming'],[{due:'2026-10-04'},'later'],[{},'later'],[{focus:true},'later']])assert.equal(run(`TaskPlanning.bucket(${JSON.stringify(task)},'${today}')`),wanted);
assert.equal(run(`TaskPlanning.add('2026-12-31',1)`),'2027-01-01');assert.equal(run(`TaskPlanning.add('2026-03-07',1)`),'2026-03-08');
const change=run(`TaskPlanning.change('tomorrow','${today}')`);assert.equal(change.scheduledFor,'2026-09-20');assert.ok(!('due' in change));assert.ok(run(`TaskPlanning.label({scheduledFor:'2026-09-18'},'${today}')`).startsWith('Rolled over'));
console.log('Explicit deferral, overdue rollover, 14-day horizon and deadline preservation passed.');
