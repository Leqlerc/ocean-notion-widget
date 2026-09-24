'use strict';
(()=>{
  const {$,esc,dayKey}=NOcean;
  function reset(){$('reflectionEditor').reset();$('reflectionId').value='';$('reflectionDate').value=dayKey();}
  function render(){$('reflectionGrid').innerHTML=NOceanStore.machine().reflections.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<article class="card reflection-tile"><h3>${esc(x.title)}</h3><small>${esc(x.type)} · ${esc(x.date)}</small><p>${esc(x.body)}</p><div><button data-reflection-edit="${esc(x.id)}">Edit</button><button data-reflection-delete="${esc(x.id)}">Delete</button></div></article>`).join('')||'<p class="empty">Your next reflection starts here.</p>';}
  $('reflectionEditor').onsubmit=e=>{e.preventDefault();const entry={title:$('reflectionTitle').value.trim(),date:$('reflectionDate').value,type:$('reflectionType').value,body:$('reflectionBody').value.trim()};if(!entry.title||!entry.body)return;try{const id=$('reflectionId').value;if(id)NOceanStore.editReflection(id,entry);else NOceanStore.addReflection(entry);reset();render();$('reflectionMessage').textContent='Saved.';}catch(error){$('reflectionMessage').textContent=error.message;}};
  $('reflectionGrid').onclick=e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.reflectionEdit||b.dataset.reflectionDelete,x=NOceanStore.machine().reflections.find(x=>x.id===id);if(!x)return;
    if(b.dataset.reflectionEdit){$('reflectionId').value=id;$('reflectionTitle').value=x.title;$('reflectionDate').value=x.date;$('reflectionType').value=['Reflection','Hotwash'].includes(x.type)?x.type:'Reflection';$('reflectionBody').value=x.body;$('reflectionTitle').focus();}
    else try{NOceanStore.removeReflection(id);if($('reflectionId').value===id)reset();render();$('reflectionMessage').textContent='Deleted.';}catch(error){$('reflectionMessage').textContent=error.message;}
  };
  $('cancelReflection').onclick=reset;window.addEventListener('storage',render);reset();render();
})();
