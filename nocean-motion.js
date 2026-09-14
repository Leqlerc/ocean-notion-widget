'use strict';
// Keyed rows preserve native scroll position/focus and avoid whole-list redraws.
const TaskMotion = (() => {
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function render(root,tasks,rowHTML,emptyHTML) {
    const scroll=root.scrollTop;
    const current=new Map([...root.querySelectorAll('[data-task-id]')].map(el=>[el.dataset.taskId,el]));
    const wanted=new Set(tasks.map(t=>t.id));
    const focused=document.activeElement;
    const focusId=focused?.closest('[data-task-id]')?.dataset.taskId;
    const focusKind=focused?.matches('[data-complete]')?'[data-complete]':focused?.matches('[data-focus]')?'[data-focus]':'[data-edit]';
    root.querySelector('.empty')?.remove();
    let cursor=root.firstElementChild;
    for(const task of tasks) {
      const html=rowHTML(task);let row=current.get(task.id);
      if(row?.classList.contains('leaving')) {row.getAnimations().forEach(a=>a.cancel());row.classList.remove('leaving');}
      if(!row){const template=document.createElement('template');template.innerHTML=html;row=template.content.firstElementChild;row.dataset.markup=html;root.insertBefore(row,cursor);if(!reduced())row.animate([{height:'0px',minHeight:0,paddingTop:0,paddingBottom:0,opacity:0},{height:row.getBoundingClientRect().height+'px',opacity:1}],{duration:180,easing:'ease-out'});}
      else if(row.dataset.markup!==html){const template=document.createElement('template');template.innerHTML=html;const replacement=template.content.firstElementChild;row.replaceChildren(...replacement.childNodes);row.className=replacement.className;row.dataset.markup=html;}
      if(row!==cursor)root.insertBefore(row,cursor);
      cursor=row.nextElementSibling;
    }
    for(const [id,row] of current) if(!wanted.has(id)&&!row.classList.contains('leaving')) {
      const finish=()=>{row.remove();if(!root.querySelector('[data-task-id]'))root.innerHTML=emptyHTML;};
      if(reduced()){finish();continue;}
      row.classList.add('leaving');row.style.pointerEvents='none';
      const animation=row.animate([{height:row.getBoundingClientRect().height+'px',opacity:1,paddingTop:'12px',paddingBottom:'12px'},{height:'0px',opacity:0,paddingTop:0,paddingBottom:0,borderWidth:0}],{duration:240,easing:'ease-out',fill:'forwards'});
      animation.onfinish=finish;animation.oncancel=()=>{row.style.pointerEvents='';};
    }
    if(!root.children.length)root.innerHTML=emptyHTML;
    root.scrollTop=scroll;
    if(focusId && !document.activeElement?.closest('[data-task-id]'))root.querySelector(`[data-task-id="${CSS.escape(focusId)}"] ${focusKind}`)?.focus({preventScroll:true});
  }
  return {render};
})();
