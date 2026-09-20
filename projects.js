'use strict';
(() => {
 const {$,esc,empty}=NOcean,store=NOceanData.projects;
 let projects=[],tasks=[],loaded=false,loading=false,saving=false,revision=0,editing=null,limit=25;
 const selected=()=>projects.find(p=>p.id===location.hash.slice(1));
 const dateLabel=value=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value.length===10?value+'T12:00:00':value)):'No target date';
 function taskLink(t,p){return `<a class="project-task-link" href="${esc(ProjectModel.taskURL(p.id,t.id))}"><strong>${esc(t.name)}</strong><small>${esc(t.status==='done'?'Completed':TaskPlanning.label(t)||'Unplanned')}${t.due?' · Due '+esc(Deadlines.label(t.due)):''}${t.course?' · '+esc(t.course):''}</small></a>`;}
 function render(){
  if(!loaded)return;
  const project=selected(),hasSelection=Boolean(location.hash);
  $('projectIndex').hidden=hasSelection;$('projectDetail').hidden=!hasSelection;
  if(hasSelection&&!project){$('projectDetail').innerHTML='<div class="card module-card"><h2>Project unavailable</h2><p>It may have been removed. Refresh or return to your projects.</p><a href="/projects.html">All projects</a></div>';return;}
  if(project){
   const s=ProjectModel.summarize(project,tasks),url=NOcean.safeURL(project.url);
   $('projectDetail').innerHTML=`<div class="project-actions"><a href="/projects.html">← All projects</a></div><section class="card module-card"><div class="card-head"><div><p class="eyebrow">${esc(project.status)}</p><h2>${esc(project.name)}</h2></div><button id="editProject">Edit project</button></div><dl class="project-overview"><div><dt>Target date</dt><dd>${esc(dateLabel(project.due))}</dd></div><div><dt>Task completion</dt><dd>${s.percent===null?'No tasks yet':s.percent+'%'}</dd></div><div><dt>Open tasks</dt><dd>${s.open.length}</dd></div></dl>${s.percent===null?'':`<progress class="project-progress" max="100" value="${s.percent}" aria-label="Task completion"></progress><p class="section-note">${s.done} of ${s.related.length} tasks complete. Project lifecycle is managed separately.</p>`}<div class="project-actions"><a href="${esc(ProjectModel.taskURL(project.id))}">Plan or add related tasks →</a>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Project notes in Notion ↗</a>`:''}</div></section><div class="project-columns"><section class="card module-card"><h2>Next actions</h2><p class="section-note">${s.today} Today · ${s.tomorrow} Tomorrow${s.overdue?' · '+s.overdue+' overdue':''}</p>${s.next.slice(0,5).map(t=>taskLink(t,project)).join('')||empty('No open actions. Add a task or review your project’s status.')}</section><section class="card module-card"><h2>Related work</h2><p class="section-note">${s.related.length} tasks · includes completed work</p>${[...s.next,...s.related.filter(t=>t.status==='done')].slice(0,limit).map(t=>taskLink(t,project)).join('')||empty('Your first related task will appear here.')}<button id="moreRelated" ${s.related.length<=limit?'hidden':''}>Show more</button></section></div>`;
   window.NOceanProjectPlan?.mount(project.id);
   $('editProject').onclick=()=>openEditor(project);$('moreRelated').onclick=()=>{limit+=25;render();};
  }else{
   window.NOceanProjectPlan?.reset();
   const query=$('projectSearch').value.trim().toLowerCase(),status=$('statusFilter').value;
   const visible=projects.filter(p=>(status==='all'||p.status===status)&&p.name.toLowerCase().includes(query)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.name.localeCompare(b.name));
   $('projectGrid').innerHTML=visible.map(p=>{const s=ProjectModel.summarize(p,tasks);return `<a class="workspace-link" href="#${esc(p.id)}"><h3>${esc(p.name)}</h3><p>${esc(p.status)} · ${esc(dateLabel(p.due))}</p>${s.percent===null?'<p>No related tasks yet</p>':`<progress class="project-progress" max="100" value="${s.percent}" aria-label="Task completion for ${esc(p.name)}"></progress><p>${s.done} / ${s.related.length} tasks complete</p>`}<p>${s.today} Today · ${s.tomorrow} Tomorrow${s.overdue?' · '+s.overdue+' overdue':''}</p></a>`;}).join('')||empty('No matching projects. Create one or change the filters.');
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
