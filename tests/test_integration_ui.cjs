const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require(process.env.DOM_MODULE);
const wait=()=>new Promise(r=>setTimeout(r,10));
(async()=>{
 const calls=[];
 const dom=new JSDOM(fs.readFileSync('integrations.html','utf8'),{url:'https://nocean.example/integrations.html',runScripts:'outside-only'});
 const w=dom.window;
 let authenticated=false;
 w.fetch=async(path,options)=>{
  const data=options.body?JSON.parse(options.body):null;calls.push({path,data,method:options.method});
  if(path==='/api/integration-session'&&data){authenticated=true;return {ok:true,json:async()=>({ok:true})};}
  if(path==='/api/integration-session')return {ok:true,json:async()=>({authenticated,configured:true,csrf:'token'})};
  if(data?.action==='outlook-save')return {ok:false,json:async()=>({error:'Network failed; retry the same request.'})};
  if(data?.action==='brightspace-sync')return {ok:true,json:async()=>({created:1,updated:1,unchanged:3,archived:0,remaining:0,skipped:2,skippedPast:4})};
  return {ok:true,json:async()=>({ready:true,accounts:[],events:[],outlookConfigured:true})};
 };
 w.eval(fs.readFileSync('integrations.js','utf8'));await wait();
 assert.equal(w.document.getElementById('workspace').hidden,true);
 const submit=id=>w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 w.document.getElementById('ownerSecret').value='private';submit('login');await wait();
 assert.equal(w.document.getElementById('workspace').hidden,false);
 assert.equal(w.document.getElementById('ownerSecret').value,'');
 w.document.getElementById('eventName').value='Test';
 w.document.getElementById('eventStart').value='2026-09-24T12:00';w.document.getElementById('eventEnd').value='2026-09-24T13:00';
 submit('eventForm');await wait();submit('eventForm');await wait();
 const saves=calls.filter(c=>c.data?.action==='outlook-save');assert.equal(saves.length,2);assert.equal(saves[0].data.operationId,saves[1].data.operationId);
 assert.equal(w.document.getElementById('eventName').value,'Test');
 w.document.getElementById('eventName').value='Changed';submit('eventForm');await wait();
 assert.equal(calls.filter(c=>c.data?.action==='outlook-save').length,2);
 w.document.getElementById('syncBrightspace').click();await wait();
 assert.match(w.document.getElementById('message').textContent,/9 discovered · 1 created · 1 adopted\/updated · 3 unchanged · 6 skipped \(4 past, 0 archived, 2 feed entries\).*no reconciliation warnings/);
 dom.window.close();console.log('PASS: owner unlock, secret clearing, save failure preserves input/idempotency key, changed uncertain retry blocked, coursework sync result.');
})();
