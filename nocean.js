'use strict';
const {CONFIG,$,esc,safeURL,dayKey,dateDay,dateObject,shortDate,timeLabel,empty,request,renderFacilities} = NOcean;
const state = {tasks:[], projects:[], projectPending:new Set(), projectRevision:0, removalTimers:new Map(), showInactiveProjects:false, lingering:new Set(), rowPositions:new Map(), courses:[], statuses:[], tab:'today', showDone:false, events:[], month:dayKey().slice(0,7), selectedDay:null, pending:new Set(), revision:0, loading:new Set(), health:{}, loaded:{}, creating:false};

const TaskStore = {
  list: () => request('/api/tasks'),
  create: task => request('/api/tasks', {method:'POST', body:JSON.stringify(task)}),
  archive: id => request('/api/tasks', {method:'DELETE', body:JSON.stringify({id})}),
  update: task => request('/api/tasks', {method:'PATCH', body:JSON.stringify(task)})
};
const ProjectStore = {load:()=>request('/api/projects'),create:name=>request('/api/projects',{method:'POST',body:JSON.stringify({name})}),update:(id,status)=>request('/api/projects',{method:'PATCH',body:JSON.stringify({id,status})})};
const CalendarProvider = {load: () => request('/api/events')};
const DiningProvider = {load: () => request('/api/dining')};
const RecProvider = {load: () => request('/api/recwell')};
const WeatherProvider = {load: () => request(CONFIG.weather)};
let toastTimer;
function toast(message,undo) {
  $('toast').replaceChildren(document.createTextNode(message));
  if(undo){const button=document.createElement('button');button.textContent='Undo';button.className='quiet';button.addEventListener('click',()=>{button.disabled=true;undo();$('toast').hidden=true;},{once:true});$('toast').append(button);}
  $('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6000);
}
function syncStatus() {
  const failed = Object.entries(state.health).filter(([, ok]) => !ok).map(([name]) => name);
  $('syncStatus').textContent = failed.length ? `${failed.join(', ')} unavailable` : state.loading.size ? 'Refreshing…' : 'Up to date';
}
async function loadPanel(name, fn) {
  if (state.loading.has(name)) return;
  state.loading.add(name); syncStatus();
  try { await fn(); state.health[name] = true; state.loaded[name] = true; }
  catch { state.health[name] = false; }
  finally { state.loading.delete(name); syncStatus(); }
}
function dueLabel(task) {
  if (!task.due) return '';
  const day=Deadlines.fields(task.due).date,today=Deadlines.fields(new Date().toISOString()).date;
  const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(day+'T12:00:00'));
  const label=day===today?'Due today':day<today?`Overdue · ${date}`:`Due ${date}`;
  const time=task.due.length>10?new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(task.due)):'';
  return `<span class="${day<today&&task.status!=='done'?'overdue':''}">${esc(label)}${time?' · '+esc(time):''}</span>`;
}
function isToday(task) {
  const today = Deadlines.fields(new Date().toISOString()).date;
  return task.focus || task.status === 'doing' || (task.due && Deadlines.fields(task.due).date <= today) || (task.scheduledFor && dateDay(task.scheduledFor) <= today);
}
const dueSort = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.name.localeCompare(b.name);
function visibleTasks() {
  const result=state.tasks.filter(task => {
    if (state.lingering.has(task.id)) return true;
    if (task.status === 'done') return state.showDone && (state.tab === 'all' || (state.tab === 'today' && dateDay(task.completedOn) === dayKey()));
    return state.tab === 'all' || (state.tab === 'today' ? isToday(task) : task.due && Deadlines.fields(task.due).date > Deadlines.fields(new Date().toISOString()).date);
  }).sort((a,b) => Number(a.status === 'done') - Number(b.status === 'done') || Number(b.status === 'doing') - Number(a.status === 'doing') || Number(b.focus) - Number(a.focus) || dueSort(a,b));
  for(const id of state.lingering){const at=result.findIndex(t=>t.id===id);if(at>=0){const [task]=result.splice(at,1);result.splice(Math.min(state.rowPositions.get(id)??at,result.length),0,task);}}
  return result;
}
function taskRow(task) {
  const pending = state.pending.has(task.id), done = task.status === 'done';
  return `<div data-task-id="${esc(task.id)}" class="task-row ${done ? 'done' : ''}"><input type="checkbox" data-complete="${esc(task.id)}" ${done ? 'checked' : ''} ${pending ? 'disabled' : ''} aria-label="${done ? 'Reopen' : 'Complete'} ${esc(task.name)}"><div class="task-text"><button class="task-name" data-edit="${esc(task.id)}" ${pending ? 'disabled' : ''}>${esc(task.name)}</button><div class="task-meta">${task.project || task.course ? `<span>${esc(task.project || task.course)}</span>` : ''}${task.status === 'doing' ? '<span>Doing</span>' : ''}${dueLabel(task)}</div></div><button class="focus-button ${task.focus ? 'on' : ''}" data-focus="${esc(task.id)}" aria-pressed="${task.focus}" aria-label="${task.focus ? 'Remove focus from' : 'Focus on'} ${esc(task.name)}" ${pending ? 'disabled' : ''}>${task.focus ? '● Focus' : '+ Focus'}</button></div>`;
}
function renderTasks() {
  const tasks = visibleTasks();
  $('tasksTitle').textContent = {today:'Today', upcoming:'Upcoming tasks', all:'All tasks'}[state.tab];
  TaskMotion.render($('taskList'),tasks,taskRow,empty(state.tab === 'today' ? 'A clear slate. Add a task or choose a Focus task from All.' : 'No tasks in this view.'));
  $('taskCount').textContent = `${tasks.filter(t => t.status !== 'done').length} to do`;
  const done = state.tasks.filter(t => t.status === 'done' && dateDay(t.completedOn) === dayKey()).length;
  $('doneCount').textContent = `${done} done today`;
  $('taskHint').textContent = {today:'Focus, Doing, and tasks scheduled or due by today.', upcoming:'Future deadlines, ordered by what’s next.', all:'All your tasks. Click a task name to edit.'}[state.tab];
  renderProjects();
}
function deriveProjects(tasks,projects=state.projects) {
  return projects.filter(p=>state.showInactiveProjects || p.status==='Active').map(project=>{
    const related=tasks.filter(t=>(t.projectIds || []).includes(project.id) || (!(t.projectIds || []).length && t.project===project.name));
    const unfinished=related.filter(t=>t.status!=='done');
    const done=related.length-unfinished.length;
    return {...project,total:related.length,done,count:unfinished.length,percent:related.length?Math.round(done/related.length*100):0,
      next:[...unfinished].sort((a,b)=>Number(b.status==='doing')-Number(a.status==='doing')||Number(b.focus)-Number(a.focus)||dueSort(a,b))[0],
      due:[...unfinished].filter(t=>t.due).sort(dueSort)[0]?.due};
  }).sort((a,b)=>(a.due || '9999').localeCompare(b.due || '9999')||a.name.localeCompare(b.name));
}
function renderProjects() {
  $('projectOptions').innerHTML = [...new Set(state.projects.filter(p=>p.status==='Active').map(p=>p.name))].sort().map(p => `<option value="${esc(p)}"></option>`).join('');
  const scroll=$('projects').scrollLeft;
  $('projects').innerHTML=deriveProjects(state.tasks).map(p=>`<article class="project" data-project-id="${esc(p.id)}"><div class="project-heading"><h3>${esc(p.name)}</h3><select aria-label="Status of ${esc(p.name)}" data-project-status="${esc(p.id)}" ${state.projectPending.has(p.id)?'disabled':''}>${['Active','Completed','Archived'].map(status=>`<option ${status===p.status?'selected':''}>${status}</option>`).join('')}</select></div><div class="project-progress"><progress max="100" value="${p.percent}" aria-label="${esc(p.name)} progress"></progress><small>${p.done}/${p.total} · ${p.percent}%</small></div>${p.next?`<button class="project-next" data-edit="${esc(p.next.id)}"><small>Next → </small>${esc(p.next.name)}</button>`:`<p class="section-note">${p.total?'All tasks complete · project '+p.status.toLowerCase():'No tasks yet'}</p>`}<div class="project-footer"><small>${p.count} unfinished</small><button class="quiet" data-project="${esc(p.name)}" aria-label="Add task to ${esc(p.name)}">+ Task</button></div></article>`).join('') || empty(state.loaded.Projects?'No active projects. Create one to begin.':'Loading projects…');
  $('projects').scrollLeft=scroll;
}
async function loadProjects() {
  if(state.projectPending.size)return;
  return loadPanel('Projects',async()=>{const revision=state.projectRevision;try{const data=await ProjectStore.load();if(state.projectPending.size || revision!==state.projectRevision)return;state.projects=data.projects;state.loaded.Projects=true;$('projectMessage').textContent='';renderProjects();}catch(e){$('projectMessage').textContent=e.message;throw e;}});
}
async function setProjectStatus(id,status) {
  if(state.projectPending.has(id))return;
  state.projectPending.add(id);state.projectRevision++;renderProjects();
  try{const result=await ProjectStore.update(id,status);state.projects=state.projects.map(p=>p.id===id?result.project:p);toast('Project '+status.toLowerCase()+'.');}
  catch(e){$('projectMessage').textContent=e.message;}
  finally{state.projectPending.delete(id);state.projectRevision++;renderProjects();}
}
async function loadTasks() {
  if (state.pending.size || state.creating) return;
  return loadPanel('Tasks', async () => {
    const revision = state.revision;
    try {
      const data = await TaskStore.list();
      if (revision !== state.revision || state.pending.size || state.creating) return;
      state.tasks = data.tasks; state.courses = data.courses; state.statuses = data.statuses;
      $('taskMessage').textContent = ''; renderTasks();
    } catch (error) {
      $('taskMessage').textContent = state.loaded.Tasks ? 'Refresh failed; showing your last loaded tasks.' : error.message;
      if (!state.loaded.Tasks) { $('taskList').innerHTML = empty('Use Refresh to reconnect to your tasks.'); }
      throw error;
    }
  });
}
async function updateTask(id, changes) {
  if (state.pending.has(id)) return false;
  const original = state.tasks.find(t => t.id === id);
  if (!original) return false;
  clearTimeout(state.removalTimers.get(id));
  const completing=changes.status==='done' && original.status!=='done';
  const unfocusing=changes.focus===false && original.focus;
  if(completing || unfocusing){state.rowPositions.set(id,visibleTasks().findIndex(t=>t.id===id));state.lingering.add(id);}
  state.pending.add(id); state.revision++;
  const optimistic = {...original, ...changes};
  if (changes.status) optimistic.completedOn = changes.status === 'done' ? dayKey() : null;
  state.tasks = state.tasks.map(t => t.id === id ? optimistic : t); renderTasks();
  try {
    const data = await TaskStore.update({id, ...changes});
    state.tasks = state.tasks.map(t => t.id === id ? data.task : t);
    $('taskMessage').textContent = '';
    if(completing || unfocusing){
      toast(completing?'Task completed':'Removed from Focus',()=>updateTask(id,completing?{status:original.status}:{focus:original.focus}));
      state.removalTimers.set(id,setTimeout(()=>{state.lingering.delete(id);state.rowPositions.delete(id);state.removalTimers.delete(id);renderTasks();},300));
    } else state.lingering.delete(id);
    return true;
  } catch (error) {
    state.lingering.delete(id);
    state.tasks = state.tasks.map(t => t.id === id ? original : t);
    $('taskMessage').textContent = error.message;
    $('editError').textContent = error.message; toast('Save failed. The task was restored.'); return false;
  } finally { state.pending.delete(id); state.revision++; renderTasks(); }
}
function openEditor(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || state.pending.has(id)) return;
  $('editId').value = id; $('editName').value = task.name; $('editProject').value = task.project;
  const deadline=Deadlines.fields(task.due); $('editDue').value=deadline.date; $('editTime').value=deadline.time; $('editDue').dataset.original=deadline.date; $('editTime').dataset.original=deadline.time; $('editFocus').checked = task.focus;
  $('editCourse').innerHTML = ['',[...new Set([...state.courses, task.course].filter(Boolean))]].flat().map(c => `<option value="${esc(c)}">${esc(c || 'None')}</option>`).join('');
  $('editCourse').value = task.course;
  $('editStatus').innerHTML = state.statuses.map(s => `<option value="${esc(s)}">${esc(s[0].toUpperCase()+s.slice(1))}</option>`).join('');
  $('editStatus').value = task.status; $('editError').textContent = ''; $('editDialog').showModal();
}
function renderWeather(data) {
  const code = data.current?.weather_code, temp = data.current?.temperature_2m;
  if (temp == null) throw new Error('Weather unavailable');
  const conditions = {0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Snow showers',95:'Thunderstorm',96:'Storms with hail',99:'Storms with hail'};
  const hour = new Intl.DateTimeFormat('en-GB',{timeZone:CONFIG.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date());
  const next = (data.hourly?.time || []).findIndex(t => t >= dayKey() + 'T' + hour + ':00');
  const rain = next < 0 ? [] : (data.hourly?.precipitation_probability || []).slice(next, next+6).filter(Number.isFinite);
  const fmt = v => Number.isFinite(v) ? Math.round(v) + '°' : '—';
  $('weather').innerHTML = `<div class="weather-temp">${fmt(temp)}<span class="muted"> F</span></div><div class="weather-condition">${esc(conditions[code] || 'Current weather')}</div><div class="weather-detail">H ${fmt(data.daily?.temperature_2m_max?.[0])} · L ${fmt(data.daily?.temperature_2m_min?.[0])}<br>${rain.length ? Math.max(...rain) + '% rain · next 6h' : 'Rain forecast unavailable'}</div>`;
}
function renderRec(data) { $('recreation').innerHTML = renderFacilities(data); }
function renderDining(data) {
  $('dining').innerHTML = data.courts.map(court => {
    const status = court.open === null ? 'Unavailable' : court.open ? 'Open' : 'Closed';
    const meal = court.meal ? `${court.open ? '' : 'Next: '}${court.date > dayKey() ? 'tomorrow ' : ''}${court.meal}` : '';
    return `<article class="dining-court"><div class="court-top"><div class="court-heading">${esc(court.name)} <span class="badge ${court.open ? 'open' : ''}">${status}</span></div><div class="court-meta">${esc(meal)}${court.start ? ` · ${esc(timeLabel(court.start))}–${esc(timeLabel(court.end))}` : ''}</div></div><div>${court.picks.map(p => `<div class="pick"><span>${esc(p.name)}</span><div class="macros" title="${esc(p.serving || 'Serving size unavailable')}">${p.protein == null ? 'Nutrition unavailable' : `<span class="protein">${p.protein}g P</span> · ${p.fat == null ? 'Fat unavailable' : p.fat+'g F'} · ${p.sodium == null ? 'Sodium unavailable' : p.sodium+'mg Na'}`}${p.serving ? ' · '+esc(p.serving.replace(/ Serving$/i,'')) : ''}</div></div>`).join('') || empty(court.message || 'No protein picks published.')}</div></article>`;
  }).join('');
}
const importantEvent = event => CalendarSemantics.classify(event).key !== 'class';
const routineEvent = event => CalendarSemantics.classify(event).key === 'class';
function eventOnDay(event, day) {
  const start = dateDay(event.at), end = dateDay(event.end || event.at);
  return start <= day && (event.exclusiveEnd && event.end?.length === 10 ? day < end : day <= end);
}
function eventIsFuture(event) {
  const end = event.end || event.at;
  return end.length === 10 ? (event.exclusiveEnd && event.end ? end > dayKey() : end >= dayKey()) : new Date(end).getTime() >= Date.now();
}
function eventLabel(event) {
  const day = dateDay(event.at), today = dayKey();
  const prefix = day === today ? 'Today' : new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,weekday:'short',month:'short',day:'numeric'}).format(dateObject(event.at));
  return prefix + (event.at.length > 10 ? ' · '+timeLabel(event.at) : ' · All day');
}
function renderEvents() {
  const relevant = state.events.filter(e => state.selectedDay ? eventOnDay(e, state.selectedDay) : eventIsFuture(e) && !routineEvent(e)).sort((a,b) => dateObject(a.at).getTime()-dateObject(b.at).getTime());
  $('eventList').innerHTML = (state.selectedDay ? `<p class="section-note">${esc(shortDate(state.selectedDay))}</p>` : '') + (relevant.slice(0,30).map(e => `<div class="event-row event-${CalendarSemantics.classify(e).key}"><small>${esc(eventLabel(e))} · ${esc(CalendarSemantics.classify(e).short || CalendarSemantics.classify(e).label)}</small>${safeURL(e.url) ? `<a href="${esc(safeURL(e.url))}" target="_blank" rel="noopener">${esc(e.name)}</a>` : `<span class="event-name">${esc(e.name)}</span>`}</div>`).join('') || empty(state.selectedDay ? 'No events this day.' : 'No upcoming events beyond routine classes.'));
  $('clearDay').hidden = !state.selectedDay;
  renderCalendar();
}
function renderCalendar() {
  const [year,month] = state.month.split('-').map(Number), first = new Date(Date.UTC(year,month-1,1));
  $('monthTitle').textContent = first.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',year:'numeric'});
  const start = new Date(first); start.setUTCDate(1-first.getUTCDay());
  let html = ['S','M','T','W','T','F','S'].map(d => `<span class="weekday">${d}</span>`).join('');
  for (let n=0;n<42;n++) {
    const date = new Date(start); date.setUTCDate(start.getUTCDate()+n);
    const day = date.toISOString().slice(0,10), events = state.events.filter(e => eventOnDay(e,day));
    const semantic = CalendarSemantics.highest(events);
    const classes = ['day', semantic ? 'event-'+semantic.key : '',day.slice(0,7)!==state.month?'other':'',day===dayKey()?'today':'',day===state.selectedDay?'selected':'',events.length?'has-events':'',events.some(importantEvent)?'important':''].join(' ');
    html += `<button class="${classes}" data-day="${day}" aria-label="${day}, ${events.length} events${events.length ? ': '+esc(events.map(e=>e.name).join('; ')) : ''}" aria-pressed="${day===state.selectedDay}" title="${esc(events.map(e=>e.name).join('\n') || 'No events')}">${date.getUTCDate()}${semantic && semantic.key !== 'class' ? `<span class="day-type">${esc(semantic.short || semantic.label)}</span>` : ''}</button>`;
  }
  $('calendarGrid').innerHTML = html;
}
async function loadCalendar() {
  return loadPanel('Calendar', async () => {
    try {
      const data = await CalendarProvider.load(); state.events = data.events.filter(e => e.at && Number.isFinite(dateObject(e.at).getTime()));
      $('calendarSource').textContent = `${data.source} · Checked ${timeLabel(data.updatedAt)}`;
      $('calendarSource').dataset.provider = data.direct ? 'google' : 'notion';
      $('calendarSource').title = (data.warnings || []).join(' · ') || 'Google and Notion checked independently every 45 seconds while visible.';
      renderEvents();
    } catch (error) {
      $('calendarSource').textContent = state.loaded.Calendar ? 'Refresh failed · showing previously loaded events' : error.message;
      if (!state.loaded.Calendar) $('eventList').innerHTML = empty('Calendar unavailable. Use the Calendar link above.');
      throw error;
    }
  });
}
async function loadCampus() {
  await Promise.allSettled([
    ['Weather', WeatherProvider, 'weather', renderWeather], ['RecWell', RecProvider, 'recreation', renderRec], ['Dining', DiningProvider, 'dining', renderDining]
  ].map(([name,provider,id,render]) => loadPanel(name, async () => {
    try { render(await provider.load()); }
    catch (error) { $(id).innerHTML = empty(`${name} unavailable. Use Refresh to try again.`); throw error; }
  })));
}
function clock() {
  $('clock').textContent = new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date());
}
function refreshAll() { return Promise.allSettled([loadTasks(),loadProjects(),loadCalendar(),loadCampus()]); }
$('quickAdd').addEventListener('submit', async event => {
  event.preventDefault(); if (state.creating) return;
  const task = {name:$('taskName').value.trim(),project:$('taskProject').value.trim(),due:Deadlines.serialize($('taskDue').value,$('taskTime').value),focus:true};
  if (!task.name) return;
  state.creating = true; state.revision++; $('addButton').disabled = true; $('taskMessage').textContent = '';
  try {
    const data = await TaskStore.create(task); state.tasks.unshift(data.task);
    // Preserve anything typed while the request was in flight.
    if ($('taskName').value.trim() === task.name) { $('taskName').value = ''; $('taskDue').value = ''; $('taskTime').value=''; } loadProjects(); setTab('today'); $('taskName').focus(); toast('Task added to Today.');
  } catch (error) { $('taskMessage').textContent = error.message; }
  finally { state.creating = false; state.revision++; $('addButton').disabled = false; }
});
function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active',b.dataset.tab===tab); b.setAttribute('aria-pressed',b.dataset.tab===tab); });
  renderTasks();
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) setTab(button.dataset.tab);
  if (button.dataset.edit) openEditor(button.dataset.edit);
  if (button.dataset.focus) { const task = state.tasks.find(t=>t.id===button.dataset.focus); if(task) updateTask(task.id,{focus:!task.focus}); }
  if (button.dataset.project) { $('taskProject').value=button.dataset.project; $('taskName').focus(); }
  if (button.dataset.day) { state.selectedDay=button.dataset.day; renderEvents(); }
});
$('taskList').addEventListener('change', event => { if(event.target.dataset.complete) updateTask(event.target.dataset.complete,{status:event.target.checked?'done':'next'}); });
$('showDone').addEventListener('change', event => { state.showDone=event.target.checked;renderTasks(); });
$('archiveTask').addEventListener('click', async () => {
  const id = $('editId').value;
  if (state.pending.has(id)) return;
  const original = state.tasks.find(t => t.id === id);
  state.pending.add(id); state.revision++;
  $('archiveTask').disabled = true; $('saveEdit').disabled = true;
  state.tasks = state.tasks.filter(t => t.id !== id); renderTasks();
  try {
    await TaskStore.archive(id); $('editDialog').close(); toast('Task archived. It can be restored from Trash.');
  } catch (error) {
    state.tasks.push(original); $('editError').textContent = error.message;
  } finally {
    state.pending.delete(id); state.revision++; renderTasks();
    $('archiveTask').disabled = false; $('saveEdit').disabled = false;
  }
});
$('editTask').addEventListener('submit', async event => {
  event.preventDefault(); const id=$('editId').value, original=state.tasks.find(t=>t.id===id);
  $('saveEdit').disabled=true;
  const changes={name:$('editName').value.trim(),course:$('editCourse').value,status:$('editStatus').value,focus:$('editFocus').checked};
  // Editing another field must not discard an imported deadline's time or offset.
  if($('editProject').value.trim()!==original.project)changes.project=$('editProject').value.trim();
  if($('editDue').value!==$('editDue').dataset.original || $('editTime').value!==$('editTime').dataset.original) changes.due=Deadlines.serialize($('editDue').value,$('editTime').value);
  const saved=await updateTask(id,changes); $('saveEdit').disabled=false;
  if(saved){$('editDialog').close();loadProjects();}
});
for(const id of ['closeEdit','cancelEdit']) $(id).addEventListener('click',()=>$('editDialog').close());
function changeMonth(delta) { const [y,m]=state.month.split('-').map(Number);state.month=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);state.selectedDay=null;renderEvents(); }
$('prevMonth').addEventListener('click',()=>changeMonth(-1));
$('nextMonth').addEventListener('click',()=>changeMonth(1));
$('monthTitle').addEventListener('click',()=>{state.month=dayKey().slice(0,7);state.selectedDay=null;renderEvents();});
$('clearDay').addEventListener('click',()=>{state.selectedDay=null;renderEvents();});
$('refresh').addEventListener('click',refreshAll);
window.addEventListener('focus',()=>{if(!document.hidden) Promise.allSettled([loadTasks(),loadCalendar()]);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshAll();});
setInterval(()=>{if(!document.hidden) loadCalendar();},CONFIG.calendarRefresh);
setInterval(()=>{if(!document.hidden){loadTasks();loadProjects();}},CONFIG.taskRefresh);
setInterval(()=>{if(!document.hidden) loadCampus();},CONFIG.campusRefresh);
let currentDay=dayKey();
setInterval(()=>{clock();if(dayKey()!==currentDay){currentDay=dayKey();renderTasks();renderEvents();refreshAll();}},30000);
clock();renderCalendar();refreshAll();

$('newProject').addEventListener('click',()=>{$('projectDialog').showModal();$('projectName').focus();});
$('closeProject').addEventListener('click',()=>$('projectDialog').close());
$('projectForm').addEventListener('submit',async e=>{
  e.preventDefault();if($('saveProject').disabled)return;state.projectRevision++;$('saveProject').disabled=true;$('projectError').textContent='';
  try{const result=await ProjectStore.create($('projectName').value.trim());state.projects=state.projects.filter(p=>p.id!==result.project.id).concat(result.project);$('projectDialog').close();$('projectName').value='';renderProjects();}
  catch(error){$('projectError').textContent=error.message;}finally{state.projectRevision++;$('saveProject').disabled=false;}
});
$('projects').addEventListener('change',e=>{if(e.target.dataset.projectStatus)setProjectStatus(e.target.dataset.projectStatus,e.target.value);});
$('showInactiveProjects').addEventListener('change',e=>{state.showInactiveProjects=e.target.checked;renderProjects();});
