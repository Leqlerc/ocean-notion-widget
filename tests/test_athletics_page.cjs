const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const read=p=>fs.readFileSync(p,'utf8'),tick=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 const dom=new JSDOM(read('athletics.html'),{url:'https://nocean.test',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id),writes=[];
 const base={planned:'Push',workoutType:'Push',quality:'',completed:false,started:false,support:{}};
 w.fetch=async(url,options={})=>{
  let data;
  if(url.startsWith('/api/athletics')){
   const date=new URL(url,'https://nocean.test').searchParams.get('date')||$('trainingDate').value;
   if(options.method){const change=JSON.parse(options.body);writes.push(change);data=options.method==='POST'?{set:{...change,id:'s1',exercise:'Row',number:1,completed:true}}:{day:{...base,date,...change,completed:!!change.quality}};}
   else data={day:{...base,date},week:[{...base,date},{...base,date:'2026-10-02'}],sets:[],exercises:[{id:'row',name:'Row',active:true}],recent:[],canLogSets:true};
  }else if(url.startsWith('/api/dashboard'))data={days:{}};
  else return {ok:false,json:async()=>({error:'Unavailable fixture'})};
  return {ok:true,json:async()=>data};
 };
 w.eval(['nocean-shared.js','nocean-store.js','athletics.js','machine.js'].map(read).join('\n'));await tick();
 assert.equal($('setControls').disabled,false);$('exercise').value='row';$('reps').value='8';$('load').value='30';$('rir').value='2';$('warmup').checked=true;
 $('setForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.match($('sets').textContent,/8 reps · 30 lb · Warm-up · 2 RIR/);
 $('completeWorkout').click();await tick();assert.match($('workoutStatus').textContent,/Completed/);
 w.document.querySelector('[data-date="2026-10-02"]').click();await tick();assert.equal($('trainingDate').value,'2026-10-02');
 $('nutritionProtein').value='120';$('nutritionForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 const local=JSON.parse(w.localStorage.getItem('nocean.machine.local.v1'));assert.equal(local.nutrition['2026-10-02'].protein,120);
 const swim=w.document.querySelector('[data-support="swim"]');swim.checked=true;swim.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();assert.equal(writes.at(-1).date,'2026-10-02');assert.equal(writes.at(-1).support.swim,true);
 dom.window.close();console.log('Athletics passed: real tracker loads, set reps/load/RIR/warmup, completion, support work, and date-aligned nutrition.');
})().catch(e=>{console.error(e);process.exitCode=1;});
