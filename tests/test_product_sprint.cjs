const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.DOM_MODULE||'jsdom'),read=p=>fs.readFileSync(p,'utf8');
const memory=new Map(),ctx=vm.createContext({localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},crypto:require('node:crypto').webcrypto});
vm.runInContext(['calendar-semantics.js','nocean-store.js','nocean-signals.js'].map(read).join('\n')+';globalThis.C=CalendarSemantics;globalThis.S=NOceanStore;globalThis.P=NOceanSignals',ctx);
const {C,S,P}=ctx;
for(const name of ['Project available','Content posted','Module available','Announcement posted','HW 2 - Availability Ends']){
 assert.equal(C.deadline({name,due:'2026-09-24'}),false,name);assert.equal(C.eventItem({name}),false,name);
}
for(const name of ['Assignment 1','Homework','Report','Project 2','Lab 4 - Due']){assert(C.deadline({name,due:'2026-09-24'}));assert.equal(C.eventItem({name}),false);}
for(const name of ['Lecture','Club meeting','Recitation'])assert.equal(C.deadline({name,due:'2026-09-24'}),false);
for(const name of ['Exam','Test 1','Major Quiz','Interview','Major competition']){assert(C.significant({name}));assert(C.eventItem({name}));}
const events=[{name:'CS 159 Recitation',at:'2026-09-24T12:00:00Z'},{name:'CS 159 Recitation Quiz',at:'2026-09-24T08:00:00-04:00'},{name:'MA 261 Recitation',at:'2026-09-24T12:00:00Z'},{name:'CS 159 Recitation',at:'2026-09-25T12:00:00Z'}];
assert.equal(C.cleanEvents(events).length,3);assert.equal(C.cleanEvents(events)[0].name,'CS 159 Recitation Quiz');
S.saveSettings({maintenance:[{id:'interval',name:'Clean',every:3,start:'2026-09-24'},{id:'weekly',name:'Laundry',mode:'weekly',weekday:1,start:'2026-09-24'}]});
assert.equal(S.maintenanceStatus('2026-09-24')[0].isDue,true);
assert.equal(S.maintenanceStatus('2026-09-24')[1].due,'2026-09-28');
assert.equal(S.maintenanceStatus('2026-10-02')[1].due,'2026-09-28');
S.completeMaintenance('interval','2026-09-24');assert.equal(S.maintenanceStatus('2026-09-25')[0].due,'2026-09-27');
S.completeMaintenance('weekly','2026-09-29');assert.equal(S.maintenanceStatus('2026-09-29')[1].due,'2026-10-05');
S.addReflection({title:'Before',date:'2026-09-24',type:'Hotwash',body:'Text'});const id=S.machine().reflections[0].id;
S.editReflection(id,{title:'After',date:'2026-09-25',type:'Reflection',body:'Updated'});assert.equal(S.machine().reflections[0].title,'After');
S.removeReflection(id);assert.equal(S.machine().reflections.length,0);
const progress=P.progress([{date:'2026-09-23',completed:true},{date:'2026-09-24',completed:true},{date:'2026-09-25',completed:true},{date:'2026-09-26',completed:true}], '2026-09-25');
assert.equal(progress.week,2);assert.equal(progress.month,2);assert.equal(progress.streak,2);assert.equal(progress.byDay.size,2);
for(const [weather_code,wind_speed_10m,expected] of [[71,50,'snow'],[95,50,'rain'],[0,35,'wind'],[3,5,'cloud'],[0,5,'clear'],[66,0,'snow']])assert.equal(P.weather({weather_code,wind_speed_10m}),expected);
for(const page of ['index.html','tasks.html']){
 const dom=new JSDOM(read(page),{url:'https://nocean.test',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.eval(['nocean-shared.js','nocean-store.js','nocean-upkeep.js'].map(read).join('\n')+';window.U=NOceanUpkeep;window.S=NOceanStore');
 const before=$('upkeepDue').children.length;assert.equal(before,3);w.U.render();w.U.render();assert.equal($('upkeepDue').children.length,3);
 const box=$('upkeepDue').querySelector('input');box.checked=true;box.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal($('upkeepDue').children.length,2);w.U.render();assert.equal($('upkeepDue').children.length,2);
 w.U.render('tomorrow');assert.equal($('upkeepDue').hidden,true);w.U.render('today');assert.equal($('upkeepDue').hidden,false);
 $('upkeepName').value='Weekly chore';$('upkeepMode').value='weekly';$('upkeepWeekday').value='1';$('upkeepForm').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(w.S.settings().maintenance.at(-1).mode,'weekly');
 dom.window.close();
}
const dom=new JSDOM(read('reflections.html'),{url:'https://nocean.test',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
w.eval(['nocean-shared.js','nocean-store.js','nocean-ui.js','reflections.js'].map(read).join('\n'));
$('reflectionTitle').value='<unsafe>'; $('reflectionBody').value='Keep going';$('reflectionEditor').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(w.document.querySelectorAll('.reflection-tile').length,1);assert.equal(w.document.querySelector('unsafe'),null);
w.document.querySelector('[data-reflection-edit]').click();$('reflectionTitle').value='Updated';$('reflectionEditor').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(JSON.parse(w.localStorage.getItem('nocean.machine.local.v1')).reflections[0].title,'Updated');
w.document.querySelector('[data-reflection-delete]').click();assert.equal(w.document.querySelectorAll('.reflection-tile').length,0);dom.window.close();
console.log('Product sprint passed: classification, conservative deduplication, recurrence, Today projection, cutoff/progress, weather, and persisted reflection CRUD.');
