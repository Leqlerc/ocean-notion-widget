'use strict';
(() => {
  const {$,esc,dayKey,request,empty}=NOcean;
  let selected=dayKey(),daily={},toastTimer;
  const habitNames=['Meditate','Journal','Sleep early','Pray','Chinese'];
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
  function dateLabel(day){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(day+'T12:00:00'));}
  function renderLocal(){
    const data=NOceanStore.machine(),nutrition=data.nutrition[selected]||{},sleep=data.sleep[selected]||{};
    $('nutritionCalories').value=nutrition.calories||'';$('nutritionProtein').value=nutrition.protein||'';$('nutritionWater').value=nutrition.water||'';
    $('sleepHours').value=sleep.hours||'';$('sleepQuality').value=sleep.quality||'';
    $('summaryNutrition').textContent=nutrition.protein?`${nutrition.protein}g protein${nutrition.calories?' · '+nutrition.calories+' kcal':''}`:'Not logged';
    $('summarySleep').textContent=sleep.hours?`${sleep.hours}h${sleep.quality?' · '+sleep.quality:''}`:'Not logged';
    renderMaintenance();renderReflections();
  }
  function renderMaintenance(){
    const items=NOceanStore.maintenanceStatus(dayKey()),due=items.filter(x=>x.isDue&&!x.completedToday).length;
    $('summaryMaintenance').textContent=due?`${due} due`:'Clear';
    $('maintenanceList').innerHTML=items.map(item=>`<div class="maintenance-row ${item.overdue?'is-overdue':item.isDue?'is-due':''}"><div><strong>${esc(item.name)}</strong><small>${item.completedToday?'Completed today':item.last?`${item.overdue?'Overdue':'Next'} · ${esc(dateLabel(item.due))}`:'Due now · no completion yet'}</small></div><button data-maintenance="${esc(item.id)}" class="${item.completedToday?'quiet':'primary'}">${item.completedToday?'Undo':'Done today'}</button></div>`).join('')||empty('No recurring maintenance configured.');
  }
  function renderReflections(){
    const items=NOceanStore.machine().reflections;$('summaryReflection').textContent=items[0]?`${items[0].type} · ${dateLabel(items[0].date)}`:'No entry';
    $('reflectionList').innerHTML=items.slice(0,6).map(item=>`<article class="reflection-row"><div><strong>${esc(item.title)}</strong><small>${esc(item.type)} · ${esc(dateLabel(item.date))}</small><p>${esc(item.body)}</p></div><button class="quiet" data-remove-reflection="${esc(item.id)}" aria-label="Remove ${esc(item.title)}">Remove</button></article>`).join('')||empty('No reflections yet.');
  }
  async function loadHabits(){
    $('habitControls').disabled=true;$('habitStatus').textContent='Loading…';
    try{const result=await request('/api/dashboard?scope=daily');daily=result.days||{};const habits=daily[selected]?.habits||{};document.querySelectorAll('[data-habit]').forEach(input=>input.checked=Boolean(habits[input.dataset.habit]));const done=Object.values(habits).filter(Boolean).length;$('summaryHabits').textContent=`${done}/${habitNames.length} complete`;$('habitStatus').textContent=dateLabel(selected);$('habitControls').disabled=false;}
    catch{$('habitStatus').textContent='Unavailable';$('summaryHabits').textContent='Unavailable';}
  }
  async function saveHabit(input){
    $('habitControls').disabled=true;try{const result=await request('/api/dashboard',{method:'POST',body:JSON.stringify({date:selected,changes:{[input.dataset.habit]:input.checked}})});daily=result.days||daily;const habits=daily[selected]?.habits||{};$('summaryHabits').textContent=`${Object.values(habits).filter(Boolean).length}/${habitNames.length} complete`;toast('Habit saved.');}
    catch(error){input.checked=!input.checked;toast(error.message);}finally{$('habitControls').disabled=false;}
  }
  $('trainingDate').addEventListener('change',event=>{selected=event.target.value||dayKey();renderLocal();loadHabits();});
  document.addEventListener('nocean:training',event=>{if(event.detail.date!==selected)return;const d=event.detail.day;$('summaryTraining').textContent=d.completed?`${d.workoutType} · complete`:d.started?`${d.workoutType||d.planned} · ${event.detail.workingSets} sets`:`${d.planned} · not started`;});
  document.querySelector('.machine-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-machine-tab]');if(!b)return;document.querySelectorAll('[data-machine-tab]').forEach(x=>x.classList.toggle('active',x===b));$('nutritionForm').hidden=b.dataset.machineTab!=='nutrition';$('sleepForm').hidden=b.dataset.machineTab!=='sleep';});
  $('nutritionForm').addEventListener('submit',event=>{event.preventDefault();NOceanStore.saveNutrition(selected,{calories:$('nutritionCalories').value,protein:$('nutritionProtein').value,water:$('nutritionWater').value});renderLocal();toast('Nutrition saved on this device.');});
  $('sleepForm').addEventListener('submit',event=>{event.preventDefault();NOceanStore.saveSleep(selected,{hours:$('sleepHours').value,quality:$('sleepQuality').value});renderLocal();toast('Sleep saved on this device.');});
  $('habitControls').addEventListener('change',event=>{if(event.target.dataset.habit)saveHabit(event.target);});
  $('maintenanceList').addEventListener('click',event=>{const b=event.target.closest('[data-maintenance]');if(!b)return;NOceanStore.completeMaintenance(b.dataset.maintenance,dayKey());renderLocal();toast('Maintenance updated.');});
  $('reflectionForm').addEventListener('submit',event=>{event.preventDefault();NOceanStore.addReflection({date:selected,type:$('reflectionType').value,title:$('reflectionTitle').value,body:$('reflectionBody').value});$('reflectionTitle').value='';$('reflectionBody').value='';renderLocal();toast('Reflection saved.');});
  $('reflectionList').addEventListener('click',event=>{const b=event.target.closest('[data-remove-reflection]');if(!b)return;NOceanStore.removeReflection(b.dataset.removeReflection);renderLocal();});
  selected=$('trainingDate').value||dayKey();renderLocal();loadHabits();
})();
