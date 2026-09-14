const {readFileSync}=require('node:fs');
const vm=require('node:vm');const assert=require('node:assert/strict');
let stored={},classes=new Set(),attributes={};
const ctx=vm.createContext({localStorage:{setItem:(k,v)=>stored[k]=v},document:{addEventListener:()=>{},body:{dataset:{},classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}},getElementById:()=>({setAttribute:(k,v)=>attributes[k]=v})}});
vm.runInContext(readFileSync('nocean-ui.js','utf8')+'\n'+readFileSync('calendar-semantics.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
for(const [key,action] of Object.entries({n:'new','/':'new','1':'today','2':'upcoming','3':'all',r:'refresh','?':'help'}))assert.equal(run(`NOceanUI.shortcutAction({key:${JSON.stringify(key)}},false)`),action);
for(const flag of ['ctrlKey','metaKey','altKey','isComposing','repeat','shiftKey'])assert.equal(run(`NOceanUI.shortcutAction({key:'n',${flag}:true},false)`),null);
assert.equal(run(`NOceanUI.shortcutAction({key:'n',target:{closest:()=>true}},false)`),null);
assert.equal(run(`NOceanUI.shortcutAction({key:'r'},true)`),null);
assert.equal(run(`NOceanUI.shortcutAction({key:'Escape'},true)`),'close');
assert.equal(run(`NOceanUI.shortcutAction({key:'?',shiftKey:true},false)`),'help');
run('NOceanUI.setTheme(true)');assert.equal(stored['nocean.decorated'],'true');assert(classes.has('decorated'));assert.equal(attributes['aria-pressed'],'true');
run('NOceanUI.setTheme(false,false)');assert(!classes.has('decorated'));assert.equal(stored['nocean.decorated'],'true');
for(const preset of ['default','card-art','experimental']){run(`NOceanUI.setPreset('${preset}')`);assert.equal(stored['nocean.preset'],preset);assert.equal(run('document.body.dataset.preset'),preset);}
for(const [name,key] of [['MA 261 Exam','exam'],['Quiz','quiz'],['CFU','assessment'],['Practical','assessment'],['Demo','presentation'],['Roundtable','presentation'],['Meetup','personal'],['Fall Break','break'],['Lecture','class']])assert.equal(run(`CalendarSemantics.classify({name:${JSON.stringify(name)}}).key`),key);
assert.equal(run(`CalendarSemantics.classify({name:'Quiz',type:'Class'}).key`),'quiz');
assert.equal(run(`CalendarSemantics.highest([{name:'Break'},{name:'Meetup'},{name:'Quiz'},{name:'Exam',type:'Class'}]).key`),'exam');
console.log('UI contracts passed: shortcut guards, shared theme persistence, semantic priority.');
