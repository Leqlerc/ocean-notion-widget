'use strict';
(() => {
 const {$,esc,empty}=NOcean,store=NOceanData.projects;
 let projects=[],tasks=[],loaded=false,loading=false,saving=false,revision=0,editing=null,limit=25;
 const visibleProjects=()=>{const query=$('projectSearch').value.trim().toLowerCase(),status=$('statusFilter').value;return projects.filter(p=>(status==='all'||p.status===status)&&p.name.toLowerCase().includes(query)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.name.localeCompare(b.name));};
 const selected=()=>{const id=location.hash.slice(1);if(id)return projects.find(p=>p.id===id);return visibleProjects()[0]||projects.find(p=>p.status==='Active')||projects[0];};
 const dateLabel=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value.length===10?value+'T12:00:00':value)):'No target date';
 function taskLink(t,p){return `<a class="project-task-link" href="${esc(ProjectModel.taskURL(p.id,t.id))}"><strong>${esc(t.name)}</strong><small>${esc(t.status==='done'?'Completed':TaskPlanning.label(t)||'Unplanned')}${t.due?' · Due '+esc(Deadlines.label(t.due)):''}${t.course?' · '+esc(t.course):''}</small></a>`;}
 function render(){
  if(!loaded)return;
  const project=selected(),requestedId=location.hash.slice(1),visible=visibleProjects();
  $('projectIndex').hidden=false;$('projectDetail').hidden=false;
  $('projectGrid').innerHTML=visible.map(p=>{const s=ProjectModel.summarize(p,tasks),active=project?.id===p.id;return `<a class="project-tab${active?' is-selected':''}" href="#${esc(p.id)}" ${active?'aria-current="true"':''}><span class="project-tab-label">${esc(p.name)}</span><small>${esc(p.status)}${s.percent===null?' · No tasks':' · '+s.percent+'%'}</small><span class="project-tab-progress"><i style="width:${s.percent??0}%"></i></span></a>`;}).join('')||empty('No matching projects. Change the filter or create a project.');
  if(requestedId&&!project){window.NOceanProjectPlan?.reset();$('projectDetail').innerHTML='<div class="card module-card"><h2>Project unavailable</h2><p>It may have been removed. Refresh or choose another project above.</p><a href="/projects.html">Clear selection</a></div>';return;}
  if(project){
   const s=ProjectModel.summarize(project,tasks),url=NOcean.safeURL(project.url);
   $('projectDetail').innerHTML=`<section class="card project-control-panel"><div class="project-control-head"><div><p class="eyebrow">${esc(project.status)} project</p><h2>${esc(project.name)}</h2>${project.description?`<p>${esc(project.description)}</p>`:''}</div><button id="editProject">Edit project</button></div><div class="project-progress-strip"><div><strong>${s.percent===null?'No task progress yet':s.percent+'%'}</strong><span>${s.percent===null?'Add a related task to begin tracking.':s.done+' of '+s.related.length+' related tasks complete'}</span></div><div><span>Target</span><strong>${esc(dateLabel(project.due))}</strong></div><div><span>Open actions</span><strong>${s.open.length}</strong></div></div>${s.percent===null?'':`<progress class="project-progress" max="100" value="${s.percent}" aria-label="Task completion"></progress>`}<div class="project-control-grid"><section class="project-next-panel"><div class="workspace-section-head"><div><p class="eyebrow">Immediate focus</p><h3>Next</h3></div><span>${s.today} today · ${s.tomorrow} tomorrow${s.overdue?' · '+s.overdue+' overdue':''}</span></div>${s.next.slice(0,5).map(t=>taskLink(t,project)).join('')||empty('No open actions. Add the next concrete step.')}<a class="inline-action" href="${esc(ProjectModel.taskURL(project.id))}">Plan or add related tasks →</a><details class="related-work"><summary>All related work · ${s.related.length}</summary>${[...s.next,...s.related.filter(t=>t.status==='done')].slice(0,limit).map(t=>taskLink(t,project)).join('')||empty('Your first related task will appear here.')}<button id="moreRelated" ${s.related.length<=limit?'hidden':''}>Show more</button></details></section><section class="project-plan-panel"><div class="workspace-section-head"><div><p class="eyebrow">Project map</p><h3>Structure and milestones</h3></div></div><div id="projectPlanSlot"></div></section></div><div class="project-control-foot"><span>Project status is separate from task completion.</span>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Project notes in Notion ↗</a>`:''}</div></section>`;
   window.NOceanProjectPlan?.mount(project.id);
   $('editProject').onclick=()=>openEditor(project);if($('moreRelated'))$('moreRelated').onclick=()=>{limit+=25;render();};
  }else{
   window.NOceanProjectPlan?.reset();
   $('projectDetail').innerHTML='<div class="card module-card"><h2>No projects yet</h2><p>Create a project to give longer-horizon work a clear home.</p></div>';
  }
 }
 async function load(){
  if(loading||saving||window.NOceanProjectPlan?.isBusy()||$('projectEditor').open||document.getElementById('goalEditor')?.open)return;
  loading=true;const version=revision;$('refresh').disabled=true;
  try{const [p,t]=await Promise.all([store.list(),NOceanData.tasks.list()]);if(version!==revision)return;projects=p.projects;tasks=t.tasks;loaded=true;$('newProject').disabled=false;render();$('projectStatus').textContent='Projects and tasks up to date.';}
  catch(e){$('projectStatus').textContent=e.message+(loaded?' Showing the last loaded records.':' Use Refresh to retry.');}
  finally{loading=false;$('refresh').disabled=false;}
 }
 function openEditor(project=null){
  if(saving||!loaded)return;editing=project?.id||null;
  $('projectEditorTitle').textContent=editing?'Edit project':'New project';
  $('nameField').hidden=Boolean(editing);$('projectName').required=!editing;$('projectName').value=project?.name||'';
  $('projectDue').value=project?.due?.slice(0,10)||'';$('projectLifecycle').value=project?.status||'Active';$('lifecycleField').hidden=!editing;
  $('projectError').textContent='';$('projectEditor').showModal();
 }
 $('projectForm').onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const name=$('projectName').value.trim(),id=editing;
  if(!id&&!name){$('projectError').textContent='Enter a project name.';return;}
  const data={due:$('projectDue').value||null,...(id?{id,status:$('projectLifecycle').value}:{name})};
  saving=true;revision++;$('projectFields').disabled=true;$('saveProject').disabled=true;$('cancelProject').disabled=true;
  try{const {project}=await (id?store.update(data):store.create(data));projects=projects.filter(p=>p.id!==project.id);projects.push(project);$('projectEditor').close();location.hash=project.id;render();$('projectStatus').textContent='Project saved.';}
  catch(e){$('projectError').textContent=e.message;}
  finally{saving=false;revision++;$('projectFields').disabled=false;$('saveProject').disabled=false;$('cancelProject').disabled=false;}
 };
 $('projectEditor').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
 $('cancelProject').onclick=()=>$('projectEditor').close();$('newProject').onclick=()=>openEditor();
 $('projectSearch').oninput=render;$('statusFilter').onchange=render;$('refresh').onclick=load;
 window.addEventListener('hashchange',()=>{limit=25;render();});window.addEventListener('focus',load);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 setInterval(()=>{if(!document.hidden)load();},90000);load();
})();
