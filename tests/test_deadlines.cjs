const {readFileSync}=require('node:fs');
const vm=require('node:vm');const assert=require('node:assert/strict');
const ctx=vm.createContext({Date,Number,String,Math,Intl});
vm.runInContext(readFileSync('nocean-deadlines.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
for(const zone of ['America/Indiana/Indianapolis','Asia/Kolkata','Pacific/Honolulu','UTC','America/Los_Angeles']) {
 process.env.TZ=zone;
 for(const day of ['2026-09-18','2026-09-19','2026-12-18','2026-03-08','2026-11-01']) {
  for(const [time,expected] of [['','23:59'],['15:30','15:30']]) {
   const serialized=run(`Deadlines.serialize('${day}','${time}')`);
   const local=new Date(serialized);assert.equal(local.getHours(),Number(expected.slice(0,2)));assert.equal(local.getMinutes(),Number(expected.slice(3)));
   assert.equal(run(`Deadlines.fields('${serialized}').date`),day);
  }
 }
}
console.log('Deadline local day/time and DST contracts passed in five time zones.');

assert.equal(run(`Deadlines.label(Deadlines.serialize('2026-09-20'))`),'Sep 20 · 11:59 PM');
assert.equal(run(`Deadlines.label('2026-09-20')`),'Sep 20');
