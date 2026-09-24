const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=name=>fs.readFileSync(name,'utf8');

const memory=new Map(),classes=new Set(),styleValues=new Map(),rootStyles=new Map();
const tasks={dataset:{cardArt:'tasks'},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)},style:{setProperty:(key,value)=>styleValues.set(key,value),removeProperty:key=>styleValues.delete(key),getPropertyValue:key=>styleValues.get(key)||''}};
const document={body:{dataset:{}},documentElement:{style:{setProperty:(key,value)=>rootStyles.set(key,value),getPropertyValue:key=>rootStyles.get(key)||''}},querySelectorAll:()=>[tasks],getElementById:()=>null,addEventListener(){},dispatchEvent(){}};
const context={document,window:{addEventListener(){}},localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}};
vm.createContext(context);vm.runInContext(source('nocean-store.js')+';globalThis.store=NOceanStore',context);vm.runInContext(source('nocean-dashboard-appearance.js')+';globalThis.appearance=NOceanDashboardAppearance',context);
context.appearance.apply();

assert.equal(document.body.dataset.topBiomeHeight,'176');
assert.equal(document.body.dataset.cardOpacity,'100');
assert.equal(classes.has('has-card-art'),false);

assert.equal(context.appearance.setTopBiomeHeight(333),true);
assert.equal(document.body.dataset.topBiomeHeight,'333');
assert.equal(rootStyles.get('--top-biome-height'),'333px');
assert.equal(JSON.parse(memory.get('nocean.command.settings.v1')).appearance.topBiomeHeight,333);
assert.equal(context.appearance.setTopBiomeHeight(900),true);
assert.equal(context.store.settings().appearance.topBiomeHeight,500);

assert.equal(context.appearance.setCardOpacity(40),true);
assert.equal(document.body.dataset.cardOpacity,'40');
assert.equal(context.store.settings().appearance.cardOpacity,40);
assert.equal(context.appearance.setCardOpacity(1),true);
assert.equal(context.store.settings().appearance.cardOpacity,20);
assert.match(rootStyles.get('--card-surface-strong'),/^rgba\(17,37,44,0\.168\)$/);

assert.equal(context.appearance.setAccent('lavender'),true);
assert.equal(document.body.dataset.accent,'lavender');
assert.equal(rootStyles.get('--accent'),'#f3e8ff');
assert.equal(context.appearance.setDifficultyColors('glow'),true);
assert.equal(document.body.dataset.difficultyColors,'glow');
for(const mode of ['off','solid','outline']){
 assert.equal(context.appearance.setCalendarWorkload(mode),true);
 assert.equal(document.body.dataset.calendarWorkload,mode);
 assert.equal(context.store.settings().appearance.calendarWorkload,mode);
 assert.equal(JSON.parse(memory.get('nocean.command.settings.v1')).appearance.calendarWorkload,mode);
 assert.equal(context.store.settings().appearance.difficultyColors,'glow');
}
context.appearance.setCalendarWorkload('invalid');assert.equal(context.store.settings().appearance.calendarWorkload,'solid');

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
for(const id of ['topBiomeHeight','topBiomeHeightNumber','cardOpacity','cardOpacityNumber','accentColor','difficultyColors'])assert.match(settings,new RegExp(`id="${id}"`));
for(const removed of ['homeHeadingSetting','homeSubtitleSetting','resetHomeCopy'])assert.doesNotMatch(settings,new RegExp(`id="${removed}"`));
assert.match(styles,/var\(--top-biome-height,176px\)/);
assert.match(styles,/--card-surface-strong/);
assert.match(source('home.js'),/workload=items\.deadlines\.length\+items\.work\.length/);
for(const level of [1,2,3,4,5])assert.match(source('nocean.css'),new RegExp(`\\.workload-${level}`));
assert.doesNotMatch(styles,/calendar-day\.workload-[1-5]\{background:linear-gradient/);
assert.match(styles,/\.card\{background-color:[^}]+backdrop-filter:none/);
assert.match(styles,/\.calendar-day\.is-today\{box-shadow:/);assert.match(styles,/\.calendar-day\.is-selected\{outline:/);
assert.match(source('home.js'),/Good \$\{period\}, Will/);assert.match(source('home.js'),/Added to \$\{/);
for(const key of ['tasks','deadlines','events','campus','calendar'])assert.match(page,new RegExp(`data-card-art="${key}"`));

console.log('Dashboard appearance passed: numeric biome height, global card opacity, and per-card art persist safely without changing the Campus/Calendar layout.');
