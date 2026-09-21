const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=name=>fs.readFileSync(name,'utf8');

const memory=new Map(),classes=new Set(),styleValues=new Map();
const tasks={dataset:{cardArt:'tasks'},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)},style:{setProperty:(key,value)=>styleValues.set(key,value),removeProperty:key=>styleValues.delete(key),getPropertyValue:key=>styleValues.get(key)||''}};
const document={body:{dataset:{}},querySelectorAll:()=>[tasks],addEventListener(){},dispatchEvent(){}};
const context={document,window:{addEventListener(){}},localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}};
vm.createContext(context);vm.runInContext(source('nocean-store.js')+';globalThis.store=NOceanStore',context);vm.runInContext(source('nocean-dashboard-appearance.js')+';globalThis.appearance=NOceanDashboardAppearance',context);
context.appearance.apply();

assert.equal(document.body.dataset.biomeSize,'compact');
assert.equal(classes.has('has-card-art'),false);

assert.equal(context.appearance.setBiomeSize('expanded'),true);
assert.equal(document.body.dataset.biomeSize,'expanded');
assert.equal(JSON.parse(memory.get('nocean.command.settings.v1')).appearance.topBiomeSize,'expanded');

assert.equal(context.appearance.setCard('tasks','kelp-day'),true);
assert.equal(classes.has('has-card-art'),true);
assert.equal(tasks.dataset.cardArtImage,'kelp-day');
assert.match(tasks.style.getPropertyValue('--card-art-image'),/kelp-day\.png/);

assert.equal(context.appearance.setCard('tasks','none'),true);
assert.equal(classes.has('has-card-art'),false);
assert.equal(tasks.style.getPropertyValue('--card-art-image'),'');

assert.equal(context.appearance.setCard('tasks','https://invalid.example/image.png'),true);
assert.equal(context.store.settings().appearance.cardArt.tasks,'none');
assert.equal(context.appearance.setCard('unknown','kelp-day'),false);

const page=source('index.html'),styles=source('nocean-system.css'),settings=source('integrations.html');
assert.ok(page.indexOf('class="card campus-card"')<page.indexOf('class="card calendar-card"'));
assert.match(styles,/"tasks campus campus" "calendar calendar calendar"/);
assert.match(styles,/\.calendar-card\{min-height:470px\}/);
assert.match(settings,/id="biomeSize"/);
for(const key of ['tasks','deadlines','events','campus','calendar'])assert.match(page,new RegExp(`data-card-art="${key}"`));

console.log('Dashboard appearance passed: optional biome height and per-card art persist, reset safely, and preserve the Campus/Calendar swap.');
