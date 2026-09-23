'use strict';
const {$,esc,dayKey,shortDate,dateObject,empty,request,renderFacilities} = NOcean;
const training = {date:dayKey(),data:null,busy:false,loading:false,generation:0,requestId:null};
$('trainingDate').value=training.date;
function message(text){$('trainingError').textContent=text;}
function lock(){
  const disabled=training.busy||training.loading||!training.data;
  for(const id of ['workoutControls','supportControls']) $(id).disabled=disabled;
  $('setControls').disabled=disabled||!training.data?.canLogSets;
  $('trainingDate').disabled=training.busy;
  document.querySelectorAll('[data-date],[data-remove]').forEach(el=>el.disabled=training.busy);
}
function render(){
  const data=training.data;if(!data)return;
  const day=data.day;
  $('week').innerHTML=data.week.map(d=>`<button class="week-day ${d.completed?'is-complete':''}" data-date="${esc(d.date)}" aria-pressed="${d.date===training.date}"><span>${esc(new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(dateObject(d.date)))} · ${esc(shortDate(d.date))}</span><strong>${esc(d.workoutType||d.planned)}</strong><small>${d.completed?'Completed':d.started?'In progress':d.planned==='Rest'?'Recovery day':'Planned'}</small></button>`).join('');
  $('workoutDate').textContent=shortDate(training.date)+(training.date===dayKey()?' · Today':'');
  $('workoutTitle').textContent=(day.workoutType||day.planned)+(day.planned==='Rest'&&!day.workoutType?' day':' workout');
  $('workoutStatus').textContent=day.completed?'Completed · '+day.quality:day.started?'In progress':'Not completed';
  $('workoutType').value=day.workoutType||(['Push','Pull','Legs'].includes(day.planned)?day.planned:'');
  $('quality').value=day.quality||'Productive';
  $('completeWorkout').textContent=day.completed?'Reopen workout':'Complete workout';
  const work=data.sets.filter(s=>s.completed&&!s.warmup);
  const volume=work.reduce((sum,s)=>sum+(s.externalLoad?(s.reps||0)*(s.load||0):0),0);
  $('workoutTotals').textContent=`${work.length} working sets · ${volume.toLocaleString()} lb volume`;
  $('sets').innerHTML=data.sets.length?data.sets.map(s=>`<div class="set-row"><div><strong>${esc(s.exercise)} · Set ${esc(s.number)}</strong><span>${esc(s.reps??'—')} reps · ${s.externalLoad?esc(s.load??0)+' lb':'Bodyweight'}${s.warmup?' · Warm-up':''}${s.rir!=null?' · '+esc(s.rir)+' RIR':''}${!s.completed?' · Not completed':''}</span></div><button class="quiet" data-remove="${esc(s.id)}" aria-label="Remove ${esc(s.exercise)} set ${esc(s.number)}">Remove</button></div>`).join(''):empty('No sets logged for this day.');
  const selected=$('exercise').value;
  $('exercise').innerHTML='<option value="">Choose exercise</option>'+data.exercises.filter(e=>e.active||e.rotation).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}${e.rotation?' · rotation':''}</option>`).join('');
  $('exercise').value=selected;
  $('setMessage').textContent=data.setMessage||'Bodyweight sets record reps without external-load volume. For assisted movements, log reps without external load.';
  document.querySelectorAll('[data-support]').forEach(el=>el.checked=Boolean(day.support[el.dataset.support]));
  $('recent').innerHTML=data.recent.length?data.recent.map(d=>`<div class="recent-row"><div><strong>${esc(d.workoutType||'Workout')} · ${esc(shortDate(d.date))}</strong><small>${esc(d.quality||'In progress')}</small></div><div><span>${esc(d.workingSets)} sets</span><small>${Number(d.volume).toLocaleString()} lb volume</small></div></div>`).join(''):empty('No earlier workouts in the past four weeks.');
  document.dispatchEvent(new CustomEvent('nocean:training',{detail:{date:training.date,day,workingSets:work.length,volume}}));
  lock();
}
async function loadTraining(){
  if(training.busy)return;
  const generation=++training.generation;training.loading=true;lock();message('');$('syncStatus').textContent='Refreshing…';
  try{const data=await request('/api/athletics?date='+encodeURIComponent(training.date));if(generation!==training.generation)return;training.data=data;render();$('syncStatus').textContent='Training synced';}
  catch(error){if(generation===training.generation){message(error.message);$('syncStatus').textContent='Connection unavailable';}}
  finally{if(generation===training.generation){training.loading=false;lock();}}
}
async function mutate(method,body,apply){
  if(training.busy||training.loading)return false;
  training.busy=true;++training.generation;lock();message('');$('syncStatus').textContent='Saving…';
  try{const result=await request('/api/athletics',{method,body:JSON.stringify(body)});apply(result);render();$('syncStatus').textContent='Saved';return true;}
  catch(error){message(error.message);render();$('syncStatus').textContent='Save failed';return false;}
  finally{training.busy=false;lock();}
}
function applyDay(result){
  const updated={...training.data.day,...result.day};training.data.day=updated;
  training.data.week=training.data.week.map(d=>d.date===training.date?{...d,...updated}:d);
}
function selectDate(date){if(training.busy||date===training.date||!date)return;training.date=date;training.data=null;training.requestId=null;$('trainingDate').value=date;document.dispatchEvent(new CustomEvent('nocean:training-date',{detail:{date}}));loadTraining();}
$('trainingDate').addEventListener('change',e=>selectDate(e.target.value));
$('week').addEventListener('click',e=>{const button=e.target.closest('[data-date]');if(button)selectDate(button.dataset.date);});
$('workoutType').addEventListener('change',()=>mutate('PATCH',{date:training.date,workoutType:$('workoutType').value},applyDay));
$('completeWorkout').addEventListener('click',()=>{
  const complete=training.data.day.completed;
  if(!complete&&!$('workoutType').value){message('Choose a workout type before completing. Rest days can stay uncompleted.');return;}
  mutate('PATCH',{date:training.date,quality:complete?'':$('quality').value,...(!complete?{workoutType:$('workoutType').value}:{})},applyDay);
});
$('supportControls').addEventListener('change',e=>{if(e.target.dataset.support)mutate('PATCH',{date:training.date,support:{[e.target.dataset.support]:e.target.checked}},applyDay);});
$('bodyweight').addEventListener('change',()=>{if($('bodyweight').checked)$('load').value=0;$('load').disabled=$('bodyweight').checked;});
$('exercise').addEventListener('change',()=>{const exercise=training.data.exercises.find(e=>e.id===$('exercise').value);$('bodyweight').checked=['Bodyweight','Assisted'].includes(exercise?.mode);$('load').disabled=$('bodyweight').checked;if($('bodyweight').checked)$('load').value=0;});
$('setForm').addEventListener('input',()=>training.requestId=null);
$('setForm').addEventListener('change',()=>training.requestId=null);
$('setForm').addEventListener('submit',async e=>{
  e.preventDefault();if(training.busy||training.loading)return;
  training.requestId ||= crypto.randomUUID();
  const body={date:training.date,exerciseId:$('exercise').value,reps:Number($('reps').value),load:$('bodyweight').checked?0:Number($('load').value),externalLoad:!$('bodyweight').checked,warmup:$('warmup').checked,rir:$('rir').value===''?null:Number($('rir').value),requestId:training.requestId};
  if(await mutate('POST',body,result=>{if(!training.data.sets.some(s=>s.id===result.set.id))training.data.sets.push(result.set);training.data.day.started=true;training.data.week=training.data.week.map(d=>d.date===training.date?{...d,started:true}:d);})){training.requestId=null;}
});
$('sets').addEventListener('click',e=>{const button=e.target.closest('[data-remove]');if(button)mutate('DELETE',{id:button.dataset.remove},result=>{training.data.sets=training.data.sets.filter(s=>s.id!==result.id);training.data.day.started=training.data.sets.length>0;});});
async function loadFacilities(){if(!$('recreation'))return;try{$('recreation').innerHTML=renderFacilities(await request('/api/recwell'));}catch{$('recreation').innerHTML=empty('Facilities unavailable. Refresh to try again.');}}
$('refresh').addEventListener('click',()=>{loadTraining();loadFacilities();});
loadTraining();loadFacilities();
// Refresh on return, without replacing form values while the user is editing.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.activeElement?.closest('input,select,textarea')){loadTraining();loadFacilities();}});
