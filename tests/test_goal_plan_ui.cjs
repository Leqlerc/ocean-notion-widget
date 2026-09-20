const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.DOM_MODULE);
const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
(async()=>{
 const dom=new JSDOM(fs.readFileSync('projects.html','utf8'),{url:'https://nocean.test/projects.html',runScripts:'outside-only'}),w=dom.window,$=id=>w.document.getElementById(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let items=[],fail=false,calls=[];
 w.NOcean={esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),request:async(url,options)=>{
  if(!options)return {items:JSON.parse(JSON.stringify(items))};
  const data=JSON.parse(options.body);calls.push(data);if(fail)throw Error('Save failed');
  if(data.action==='remove'){items=items.filter(x=>x.id!==data.id);return {removed:data.id};}
  const item={...data,id:data.id||'block-'+items.length,editedAt:'now'};delete item.plan;delete item.projectId;
  items=items.filter(x=>x.id!==item.id);items.push(item);return {item};
 }};
 w.eval(fs.readFileSync('project-plan.js','utf8'));w.NOceanProjectPlan.mount('p1');await wait();
 $('addGoalItem').click();$('goalText').value='Build a useful goal';$('goalForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();
 assert.match($('goalItems').textContent,/0 \/ 1 objectives/);assert.equal(items.length,1);
 const box=$('goalItems').querySelector('input');box.checked=true;box.dispatchEvent(new w.Event('change'));await wait();assert.match($('goalItems').textContent,/1 \/ 1 objectives/);
 $('addGoalItem').click();$('goalKind').value='milestone';$('goalKind').dispatchEvent(new w.Event('change'));$('goalText').value='First review';$('goalDue').value='2026-10-01';$('goalForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();
 assert.equal(items[1].due,'2026-10-01');assert.match($('goalItems').textContent,/First review/);
 $('refreshPlan').click();await wait();assert.match($('goalItems').textContent,/1 \/ 1 objectives/);
 $('addGoalItem').click();$('goalText').value='Failed save';fail=true;$('goalForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();
 assert.equal($('goalEditor').open,true);assert.equal($('goalText').value,'Failed save');assert.equal($('goalSave').disabled,true);assert.match($('goalError').textContent,/refresh the plan/);
 dom.window.close();console.log('PASS: objective create/complete/progress, dated milestone, reload and uncertain-create failure handling.');
})();
