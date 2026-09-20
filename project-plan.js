'use strict';
(() => {
 let projectId=null,items=[],generation=0,busy=false,editing=null,requestId=null,uncertain=false;
 const esc=NOcean.esc,$=id=>document.getElementById(id);
 const request=(data,method='POST')=>NOcean.request('/api/projects',{method,body:JSON.stringify({plan:true,projectId,...data})});
 const dateLabel=date=>date?new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No date';
 function mount(id){
  if(projectId===id&&$('goalPlan'))return;
  projectId=id;items=[];generation++;editing=null;busy=false;uncertain=false;
  const host=document.createElement('section');host.id='goalPlan';host.className='card module-card';
  host.innerHTML='<div class="card-head"><h2>Goal plan</h2><button id="refreshPlan">Refresh plan</button></div><p id="planStatus" role="status">Loading goal plan…</p><div id="goalItems"></div><button id="addGoalItem">Add objective, milestone or note</button>';
  $('projectDetail').append(host);
  $('refreshPlan').onclick=load;$('addGoalItem').onclick=()=>open();load();
 }
 function render(){
  if(!$('goalItems'))return;
  const objectives=items.filter(x=>x.kind==='objective'),done=objectives.filter(x=>x.done).length;
  let html=objectives.length?`<p>${done} / ${objectives.length} objectives achieved</p><progress max="${objectives.length}" value="${done}" aria-label="Objective progress"></progress>`:'<p>Define what success looks like, then add milestones toward it.</p>';
  for(const [kind,title] of [['overview','Overview'],['objective','Objectives'],['milestone','Milestones'],['note','Notes & considerations']]){
   const entries=items.filter(x=>x.kind===kind).sort((a,b)=>kind==='milestone'?(a.due||'9999').localeCompare(b.due||'9999'):0);
   if(!entries.length)continue;
   html+=`<h3>${title}</h3>`+entries.map(item=>`<div class="goal-item">${['objective','milestone'].includes(kind)?`<label><input type="checkbox" data-goal-complete="${esc(item.id)}" ${item.done?'checked':''} ${busy?'disabled':''}><span class="sr-only">Complete ${esc(item.text)}</span></label>`:''}<div><p class="goal-text">${esc(item.text)}</p>${kind==='milestone'?`<small>${item.done?'Achieved · ':''}${esc(dateLabel(item.due))}</small>`:''}</div><button data-goal-edit="${esc(item.id)}" ${busy?'disabled':''}>Edit</button></div>`).join('');
  }
  $('goalItems').innerHTML=html;
  $('goalItems').querySelectorAll('[data-goal-edit]').forEach(button=>button.onclick=()=>open(items.find(x=>x.id===button.dataset.goalEdit)));
  $('goalItems').querySelectorAll('[data-goal-complete]').forEach(box=>box.onchange=()=>complete(items.find(x=>x.id===box.dataset.goalComplete),box.checked));
 }
 async function load(){
  if(busy||$('goalEditor').open)return;
  const current=++generation,id=projectId;
  try{const result=await NOcean.request('/api/projects?plan='+encodeURIComponent(id));if(current!==generation||projectId!==id)return;items=result.items;render();$('planStatus').textContent='Goal plan saved in your project.';}
  catch(error){if(current===generation&&$('planStatus'))$('planStatus').textContent=error.message;}
 }
 function open(item=null){
  if(busy)return;editing=item;requestId=crypto.randomUUID();uncertain=false;
  $('goalKind').value=item?.kind||'objective';$('goalKind').disabled=Boolean(item);
  $('goalText').value=item?.text||'';$('goalDue').value=item?.due||'';$('goalRemove').hidden=!item;
  $('goalError').textContent='';$('goalSave').disabled=false;$('goalDueField').hidden=$('goalKind').value!=='milestone';
  $('goalEditor').showModal();
 }
 async function complete(item,done){
  if(busy)return;busy=true;generation++;render();const id=projectId,version=generation;
  try{const result=await request({...item,done},'PATCH');if(projectId===id&&generation===version){items=items.map(x=>x.id===item.id?result.item:x);$('planStatus').textContent='Objective or milestone updated.';}}
  catch(error){if(projectId===id)$('planStatus').textContent=error.message;}
  finally{busy=false;render();}
 }
 $('goalKind').onchange=()=>{$('goalDueField').hidden=$('goalKind').value!=='milestone';};
 $('goalCancel').onclick=()=>$('goalEditor').close();
 $('goalEditor').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 $('goalForm').onsubmit=async event=>{
  event.preventDefault();if(busy||uncertain)return;
  busy=true;generation++;$('goalSave').disabled=true;$('goalCancel').disabled=true;$('goalRemove').disabled=true;
  const id=projectId,item=editing;
  try{
   const result=await request({...(item||{requestId}),kind:$('goalKind').value,text:$('goalText').value,due:$('goalKind').value==='milestone'?$('goalDue').value||null:null,done:item?.done||false},item?'PATCH':'POST');
   if(id===projectId){items=items.filter(x=>x.id!==result.item.id);items.push(result.item);render();$('planStatus').textContent='Goal item saved.';}
   $('goalEditor').close();
  }catch(error){$('goalError').textContent=error.message+(item?'':' Close this dialog and refresh the plan before adding again; the save may have reached Notion.');if(!item)uncertain=true;}
  finally{busy=false;$('goalSave').disabled=uncertain;$('goalCancel').disabled=false;$('goalRemove').disabled=false;render();}
 };
 $('goalRemove').onclick=async()=>{
  if(busy||!editing)return;busy=true;generation++;const item=editing,id=projectId;
  $('goalRemove').disabled=true;$('goalSave').disabled=true;$('goalCancel').disabled=true;
  try{await request({id:item.id,editedAt:item.editedAt,action:'remove'},'PATCH');if(id===projectId)items=items.filter(x=>x.id!==item.id);$('goalEditor').close();}
  catch(error){$('goalError').textContent=error.message;}
  finally{busy=false;$('goalRemove').disabled=false;$('goalSave').disabled=false;$('goalCancel').disabled=false;render();}
 };
 window.NOceanProjectPlan={mount,isBusy:()=>busy,reset:()=>{projectId=null;generation++;items=[];}};
})();
