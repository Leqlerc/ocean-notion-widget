'use strict';
const NOceanUpkeep=(()=>{
  const {$,esc,dayKey}=NOcean;let view='today';
  function message(text){$('upkeepMessage').textContent=text;}
  function save(items){if(!NOceanStore.saveSettings({maintenance:items}))throw new Error('Unable to save upkeep on this device.');}
  function reset(){$('upkeepForm').reset();$('upkeepId').value='';$('upkeepStart').value=dayKey();schedule();}
  function schedule(){$('upkeepWeekdayLabel').hidden=$('upkeepMode').value!=='weekly';$('upkeepIntervalLabel').hidden=$('upkeepMode').value==='weekly';}
  function render(nextView=view){
    view=nextView;
    const today=dayKey(),items=NOceanStore.maintenanceStatus(today);
    $('maintenancePane').hidden=view!=='maintenance';
    $('upkeepDue').hidden=view!=='today';
    $('upkeepDue').innerHTML=items.filter(x=>x.isDue&&!x.completedToday).map(x=>`<div class="maintenance-row"><label><input type="checkbox" data-upkeep-complete="${esc(x.id)}"> ${esc(x.name)}</label><small>Upkeep · due ${esc(x.due)}</small></div>`).join('');
    $('upkeepManage').innerHTML=items.map(x=>`<div class="maintenance-row"><div><strong>${esc(x.name)}</strong><small>${x.mode==='weekly'?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][x.weekday]:`Every ${x.every} days`} · ${x.completedToday?'Completed today':'Due '+esc(x.due)}</small></div><div><button type="button" data-upkeep-edit="${esc(x.id)}">Edit</button><button type="button" data-upkeep-remove="${esc(x.id)}">Remove</button></div></div>`).join('')||'<p class="empty">No upkeep configured.</p>';
  }
  if($('upkeepForm')){
    // Anchor legacy schedules once, so an overdue weekly item never moves forward by itself.
    const initial=NOceanStore.settings().maintenance;
    if(initial.some(x=>!x.start))try{save(initial.map(x=>({...x,start:x.start||dayKey()})));}catch(e){message(e.message);}
    $('upkeepForm').onsubmit=e=>{e.preventDefault();try{const items=NOceanStore.settings().maintenance,id=$('upkeepId').value||crypto.randomUUID(),entry={id,name:$('upkeepName').value.trim(),mode:$('upkeepMode').value,every:Number($('upkeepEvery').value),weekday:Number($('upkeepWeekday').value),start:$('upkeepStart').value};if(!entry.name)return;const i=items.findIndex(x=>x.id===id);if(i<0)items.push(entry);else items[i]=entry;save(items);reset();render();document.dispatchEvent(new CustomEvent('nocean:upkeep'));message('Upkeep saved.');}catch(error){message(error.message);}};
    $('upkeepDue').onchange=e=>{const id=e.target.dataset.upkeepComplete;if(!id)return;try{NOceanStore.completeMaintenance(id,dayKey(),false);render();document.dispatchEvent(new CustomEvent('nocean:upkeep'));}catch(error){e.target.checked=false;message(error.message);}};
    $('upkeepManage').onclick=e=>{const b=e.target.closest('button');if(!b)return;const items=NOceanStore.settings().maintenance;
      if(b.dataset.upkeepEdit){const x=items.find(x=>x.id===b.dataset.upkeepEdit);$('upkeepId').value=x.id;$('upkeepName').value=x.name;$('upkeepMode').value=x.mode||'interval';$('upkeepEvery').value=x.every;$('upkeepWeekday').value=x.weekday||0;$('upkeepStart').value=x.start||dayKey();schedule();}
      if(b.dataset.upkeepRemove)try{save(items.filter(x=>x.id!==b.dataset.upkeepRemove));render();}catch(error){message(error.message);}
    };
    $('upkeepMode').onchange=schedule;$('upkeepCancel').onclick=reset;
    window.addEventListener('storage',()=>render());
    setInterval(()=>{if(!document.hidden)render();},30000);
    reset();render();
  }
  return {render};
})();
