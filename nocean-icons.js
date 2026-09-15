'use strict';
// Small original line drawings, one viewBox and stroke style; no runtime dependency.
const NOceanIcons=(()=>{
  const paths={
    briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c5 4 13 4 18 0M10 13h4v3h-4z"/>',
    dashboard:'<rect x="3" y="3" width="7" height="10" rx="1"/><rect x="14" y="3" width="7" height="6" rx="1"/><rect x="3" y="17" width="7" height="4" rx="1"/><rect x="14" y="13" width="7" height="8" rx="1"/>',
    wrench:'<path d="M14 4a6 6 0 0 0-6 8L3 17a3 3 0 0 0 4 4l5-5a6 6 0 0 0 8-7l-4 4-4-4 4-4z"/>',
    terminal:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 8 4 4-4 4m7 0h5"/>',
    calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1"/>',
    cube:'<path d="m12 2 10 5v10l-10 5-10-5V7zm0 10 10-5M12 12 2 7m10 5v10M7 4.5l10 5"/>',
    book:'<path d="M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2z"/>',
    flask:'<path d="M9 2h6m-5 0v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 14h10m-7 4h.01m4-1h.01"/>',
    ruler:'<path d="m3 17 14-14 4 4L7 21zm4-4 2 2m2-6 2 2m2-6 2 2"/>',
    task:'<rect x="4" y="3" width="16" height="19" rx="2"/><path d="M9 3V2h6v1m-7 9 3 3 6-6"/>'
  };
  const labels={briefcase:'Briefcase',dashboard:'Dashboard',wrench:'Wrench',terminal:'Terminal',calculator:'Calculator',cube:'Cube',book:'Book',flask:'Flask',ruler:'Ruler',task:'Task'};
  const COURSE_ICONS={MA261:'calculator',CS159:'terminal',ENGR161:'ruler',MFET163:'cube',HONR19901:'book'};
  const aliases={MA26100:'MA261',CS15900:'CS159',ENGR16100:'ENGR161',MFET16300:'MFET163'};
  const valid=key=>typeof key==='string'&&Object.hasOwn(paths,key);
  const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalizeCourse(course){const match=String(course||'').toUpperCase().match(/\b(MA|CS|ENGR|MFET|HONR)\s*(\d{3,5})\b/);const key=match?match[1]+match[2]:'';return aliases[key]||key;}
  function defaultProjectIcon(project){const name=String(project?.name||'').toLowerCase();return /career|internship|job/.test(name)?'briefcase':/dashboard|productivity/.test(name)?'dashboard':/room|mainten|repair/.test(name)?'wrench':/research|science/.test(name)?'flask':/coding|program|software/.test(name)?'terminal':/math|calcul/.test(name)?'calculator':/engineering|design/.test(name)?'ruler':'cube';}
  function projectIcon(project){return valid(project?.icon)?project.icon:defaultProjectIcon(project);}
  function resolveTaskIcon(task,project){return valid(task?.icon)?task.icon:COURSE_ICONS[normalizeCourse(task?.course)]||(project?projectIcon(project):'task');}
  function svg(key){const safe=valid(key)?key:'task';return `<svg class="nocean-icon" data-icon-key="${safe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[safe]}</svg>`;}
  function slot(task,project){return `<span class="icon-slot" data-icon-project="${esc(project?.id)}" data-icon-project-name="${esc(project?.name)}" data-icon-course="${esc(task?.course)}" data-icon-explicit="${esc(valid(task?.icon)?task.icon:'')}" data-icon-kind="${task?'task':'project'}">${svg(task?resolveTaskIcon(task,project):projectIcon(project))}</span>`;}
  function apply(preference){for(const el of document.querySelectorAll('.icon-slot')){const d=el.dataset;const project=d.iconProject?{id:d.iconProject,name:d.iconProjectName,icon:preference('project:'+d.iconProject).icon}:null;const key=d.iconKind==='project'?projectIcon(project):resolveTaskIcon({icon:d.iconExplicit,course:d.iconCourse},project);if(el.firstElementChild?.dataset.iconKey!==key)el.innerHTML=svg(key);}}
  return {labels,valid,normalizeCourse,COURSE_ICONS,defaultProjectIcon,projectIcon,resolveTaskIcon,svg,slot,apply};
})();
