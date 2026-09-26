'use strict';
(() => {
 let projectId=null,items=[],generation=0,busy=false,editing=null,requestId=null,uncertain=false;
 const esc=NOcean.esc,$=id=>document.getElementById(id);
 const request=(data,method='POST')=>NOcean.request('/api/projects',{method,body:JSON.stringify({plan:true,projectId,...data})});
 const dateLabel=date=>date?new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No date';
 const today=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const ageLabel=value=>{if(!value)return '';const time=new Date(value).getTime();if(!Number.isFinite(time))return 'Recently';const days=Math.max(0,Math.floor((Date.now()-time)/86400000));return days===0?'Today':days===1?'1 day ago':days+' days ago';};
 function mount(id){
  if(projectId===id&&$('goalPlan'))return;
  const sameProject=projectId===id;
  projectId=id;if(!sameProject){items=[];generation++;editing=null;busy=false;uncertain=false;}
  const host=document.createElement('div');host.id='goalPlan';host.className='goal-plan-shell';
  host.innerHTML='<div class="goal-plan-actions"><p id="planStatus" role="status">Loading project plan…</p><button id="refreshPlan" class="quiet">Refresh</button></div><div id="goalItems"></div><button id="addGoalItem">Add project item</button>';
  ($('projectPlanSlot')||$('projectDetail')).append(host);
  $('refreshPlan').onclick=load;$('addGoalItem').onclick=()=>open();
  if(sameProject){render();$('planStatus').textContent='Goal plan saved in your project.';}else load();
 }
 function render(){
  if(!$('goalItems'))return;
  const objectives=items.filter(x=>x.kind==='objective'),done=objectives.filter(x=>x.done).length,checkpoints=items.filter(x=>x.kind==='milestone').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')),reached=checkpoints.filter(x=>x.done).length,logs=items.filter(x=>x.kind==='progress').sort((a,b)=>(b.createdAt||b.editedAt||'').localeCompare(a.createdAt||a.editedAt||''));
  const entry=(item,kind)=>{const overdue=kind==='milestone'&&!item.done&&item.due&&item.due<today();return `<div class="goal-item">${['objective','milestone'].includes(kind)?`<label><input type="checkbox" data-goal-complete="${esc(item.id)}" ${item.done?'checked':''} ${busy?'disabled':''}><span class="sr-only">Complete ${esc(item.text)}</span></label>`:''}<div><p class="goal-text">${esc(item.text)}</p>${kind==='milestone'?`<small class="${overdue?'overdue':''}">${item.done?'Achieved · ':overdue?'Overdue · ':''}${esc(dateLabel(item.due))}</small>`:''}${kind==='experiment'?`<span class="project-checkin">${esc(item.status||'Trying')}</span>`:''}${kind==='progress'?`<small>${item.status?`<span class="project-checkin">${esc(item.status)}</span> · `:''}${esc(dateLabel((item.createdAt||item.editedAt||'').slice(0,10)))}</small>`:''}</div><button data-goal-edit="${esc(item.id)}" ${busy?'disabled':''}>Edit</button></div>`;};
  const group=(kind,title,emptyText)=>{let entries=items.filter(x=>x.kind===kind);entries=kind==='milestone'?checkpoints:kind==='progress'?logs:entries;return `<details class="goal-group goal-group-${kind}" ${['milestone','objective','experiment','progress'].includes(kind)?'open':''}><summary><h4>${title}</h4></summary>${entries.map(item=>entry(item,kind)).join('')||`<p class="empty">${emptyText}</p>`}</details>`;};
  let html=objectives.length?`<div class="objective-progress"><span>${done} / ${objectives.length} objectives achieved</span><progress max="${objectives.length}" value="${done}" aria-label="Objective progress"></progress></div>`:'<p class="section-note">Define the outcome, checkpoints, and what you are learning.</p>';
  html+=`<div class="goal-plan-grid"><section class="goal-milestones" aria-label="Project action and learning"><h3>Trajectory</h3>${group('milestone','Checkpoints','Add the next dated statement of what should be true.')}${group('objective','Objectives','Add the outcomes that define success.')}${group('experiment','Experiments','Record something you are actively trying or changing.')}${group('progress','Progress log','Record what changed and how the project feels.')}</section><section class="goal-structure" aria-label="Project context"><h3>Context</h3>${group('overview','Overview','Add a concise project overview.')}${group('note','Notes','Add constraints or reference information.')}</section></div>`;
  $('goalItems').innerHTML=html;
  const next=checkpoints.find(x=>!x.done),metric=(id,label,value)=>{const node=$(id);if(!node)return;node.hidden=!value;if(value)node.innerHTML=`<span>${label}</span><strong>${esc(value)}</strong>`;};metric('objectiveMetric','Objectives',objectives.length?`${done} / ${objectives.length} achieved`:null);metric('checkpointMetric','Checkpoints',checkpoints.length?`${reached} / ${checkpoints.length} reached`:null);metric('nextCheckpointMetric','Next checkpoint',next?`${next.text} · ${dateLabel(next.due)}`:null);metric('lastLogMetric','Last progress log',logs[0]?ageLabel(logs[0].createdAt||logs[0].editedAt):null);
  $('goalItems').querySelectorAll('[data-goal-edit]').forEach(button=>button.onclick=()=>open(items.find(x=>x.id===button.dataset.goalEdit)));
  $('goalItems').querySelectorAll('[data-goal-complete]').forEach(box=>box.onchange=()=>complete(items.find(x=>x.id===box.dataset.goalComplete),box.checked));
 }
 async function load(){
  if(busy||$('goalEditor').open)return;
  const current=++generation,id=projectId;
  try{const result=await NOcean.request('/api/projects?plan='+encodeURIComponent(id));if(current!==generation||projectId!==id)return;items=result.items;render();$('planStatus').textContent='Goal plan saved in your project.';}
  catch(error){if(current===generation&&$('planStatus'))$('planStatus').textContent=error.message;}
 }
 function configureFields(){const kind=$('goalKind').value;$('goalDueField').hidden=kind!=='milestone';$('goalDue').required=kind==='milestone';$('goalStatusField').hidden=!['experiment','progress'].includes(kind);$('goalStatus').innerHTML=(kind==='experiment'?['Trying','Adopted','Dropped']:['','On track','Uncertain','Blocked']).map(value=>`<option value="${esc(value)}">${esc(value||'No check-in state')}</option>`).join('');}
 function open(item=null){
  if(busy)return;const initialKind=typeof item==='string'?item:'objective';editing=typeof item==='object'?item:null;requestId=crypto.randomUUID();uncertain=false;
  $('goalKind').value=editing?.kind||initialKind;$('goalKind').disabled=Boolean(editing);
  $('goalText').value=editing?.text||'';$('goalDue').value=editing?.due||'';$('goalRemove').hidden=!editing;configureFields();$('goalStatus').value=editing?.status||'';
  $('goalError').textContent='';$('goalSave').disabled=false;
  $('goalEditor').showModal();
 }
 async function complete(item,done){
  if(busy)return;busy=true;generation++;render();const id=projectId,version=generation;
  try{const result=await request({...item,done},'PATCH');if(projectId===id&&generation===version){items=items.map(x=>x.id===item.id?result.item:x);$('planStatus').textContent='Objective or milestone updated.';}}
  catch(error){if(projectId===id)$('planStatus').textContent=error.message;}
  finally{busy=false;render();}
 }
 $('goalKind').onchange=configureFields;
 $('goalCancel').onclick=()=>$('goalEditor').close();
 $('goalEditor').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 $('goalForm').onsubmit=async event=>{
  event.preventDefault();if(busy||uncertain)return;
  busy=true;generation++;$('goalSave').disabled=true;$('goalCancel').disabled=true;$('goalRemove').disabled=true;
  const id=projectId,item=editing;
  try{
   const kind=$('goalKind').value,result=await request({...(item||{requestId}),kind,text:$('goalText').value,due:kind==='milestone'?$('goalDue').value||null:null,status:['experiment','progress'].includes(kind)?$('goalStatus').value||null:null,done:item?.done||false},item?'PATCH':'POST');
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
 window.NOceanProjectPlan={mount,open,isBusy:()=>busy,items:()=>items.slice(),reset:()=>{projectId=null;generation++;items=[];}};
})();
