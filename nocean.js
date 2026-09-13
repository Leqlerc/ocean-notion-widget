'use strict';
const CONFIG = {
  timezone: 'America/Indiana/Indianapolis',
  calendarRefresh: 45000, taskRefresh: 90000, campusRefresh: 300000,
  weather: 'https://api.open-meteo.com/v1/forecast?latitude=40.4237&longitude=-86.9212&current=temperature_2m,weather_code&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FIndiana%2FIndianapolis&forecast_days=2'
};
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:CONFIG.timezone, year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dateDay = value => !value ? '' : value.length === 10 ? value : dayKey(new Date(value));
const dateObject = value => new Date(value.length === 10 ? value + 'T12:00:00-04:00' : value);
const shortDate = value => new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,month:'short',day:'numeric'}).format(dateObject(value));
const timeLabel = value => new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(value));
const empty = text => `<p class="empty">${esc(text)}</p>`;
const state = {tasks:[], courses:[], statuses:[], tab:'today', showDone:false, events:[], month:dayKey().slice(0,7), selectedDay:null, pending:new Set(), revision:0, loading:new Set(), health:{}, loaded:{}, creating:false};

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(url, {...options, signal:controller.signal, cache:'no-store', headers:{...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers}});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Connection failed. Please try again.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out. Refresh before retrying.');
    throw error;
  } finally { clearTimeout(timer); }
}
const TaskStore = {
  list: () => request('/api/tasks'),
  create: task => request('/api/tasks', {method:'POST', body:JSON.stringify(task)}),
  update: task => request('/api/tasks', {method:'PATCH', body:JSON.stringify(task)})
};
const CalendarProvider = {load: () => request('/api/events')};
const DiningProvider = {load: () => request('/api/dining')};
const RecProvider = {load: () => request('/api/recwell')};
const WeatherProvider = {load: () => request(CONFIG.weather)};
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
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
  const day = dateDay(task.due), today = dayKey();
  const label = day === today ? 'Due today' : day < today ? `Overdue · ${shortDate(task.due)}` : `Due ${shortDate(task.due)}`;
  return `<span class="${day < today && task.status !== 'done' ? 'overdue' : ''}">${esc(label)}${task.due.length > 10 ? ' · ' + esc(timeLabel(task.due)) : ''}</span>`;
}
function isToday(task) {
  const today = dayKey();
  return task.focus || task.status === 'doing' || (task.due && dateDay(task.due) <= today) || (task.scheduledFor && dateDay(task.scheduledFor) <= today);
}
const dueSort = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.name.localeCompare(b.name);
function visibleTasks() {
  return state.tasks.filter(task => {
    if (task.status === 'done') return state.showDone && (state.tab === 'all' || (state.tab === 'today' && dateDay(task.completedOn) === dayKey()));
    return state.tab === 'all' || (state.tab === 'today' ? isToday(task) : task.due && dateDay(task.due) > dayKey());
  }).sort((a,b) => Number(a.status === 'done') - Number(b.status === 'done') || Number(b.status === 'doing') - Number(a.status === 'doing') || Number(b.focus) - Number(a.focus) || dueSort(a,b));
}
function taskRow(task) {
  const pending = state.pending.has(task.id), done = task.status === 'done';
  return `<div class="task-row ${done ? 'done' : ''}"><input type="checkbox" data-complete="${esc(task.id)}" ${done ? 'checked' : ''} ${pending ? 'disabled' : ''} aria-label="${done ? 'Reopen' : 'Complete'} ${esc(task.name)}"><div class="task-text"><button class="task-name" data-edit="${esc(task.id)}" ${pending ? 'disabled' : ''}>${esc(task.name)}</button><div class="task-meta">${task.project || task.course ? `<span>${esc(task.project || task.course)}</span>` : ''}${task.status === 'doing' ? '<span>Doing</span>' : ''}${dueLabel(task)}</div></div><button class="focus-button ${task.focus ? 'on' : ''}" data-focus="${esc(task.id)}" aria-pressed="${task.focus}" aria-label="${task.focus ? 'Remove focus from' : 'Focus on'} ${esc(task.name)}" ${pending ? 'disabled' : ''}>${task.focus ? '● Focus' : '+ Focus'}</button></div>`;
}
function renderTasks() {
  const tasks = visibleTasks();
  $('tasksTitle').textContent = {today:'Today', upcoming:'Upcoming tasks', all:'All tasks'}[state.tab];
  $('taskList').innerHTML = tasks.map(taskRow).join('') || empty(state.tab === 'today' ? 'A clear slate. Add a task or choose a Focus task from All.' : 'No tasks in this view.');
  $('taskCount').textContent = `${tasks.filter(t => t.status !== 'done').length} to do`;
  const done = state.tasks.filter(t => t.status === 'done' && dateDay(t.completedOn) === dayKey()).length;
  $('doneCount').textContent = `${done} done today`;
  $('taskHint').textContent = {today:'Focus, Doing, and tasks scheduled or due by today.', upcoming:'Future deadlines, ordered by what’s next.', all:'All your tasks. Click a task name to edit.'}[state.tab];
  $('projectOptions').innerHTML = [...new Set(state.tasks.map(t => t.project).filter(Boolean))].sort().map(p => `<option value="${esc(p)}"></option>`).join('');
  renderProjects();
}
function deriveProjects(tasks) {
  const groups = new Map();
  for (const task of tasks) if (task.project && task.status !== 'done') {
    if (!groups.has(task.project)) groups.set(task.project, []);
    groups.get(task.project).push(task);
  }
  return [...groups].map(([name, unfinished]) => ({name, count:unfinished.length,
    next:[...unfinished].sort((a,b) => Number(b.status === 'doing') - Number(a.status === 'doing') || Number(b.focus) - Number(a.focus) || dueSort(a,b))[0],
    due:[...unfinished].filter(t => t.due).sort(dueSort)[0]?.due
  })).sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999') || a.name.localeCompare(b.name));
}
function renderProjects() {
  $('projects').innerHTML = deriveProjects(state.tasks).map(project => `<article class="project"><h3>${esc(project.name)}</h3><button class="project-next" data-edit="${esc(project.next.id)}"><small>Next → </small>${esc(project.next.name)}</button><div class="project-footer"><small>${project.count} unfinished${project.due ? ' · ' + esc(shortDate(project.due)) : ''}</small><button class="quiet" data-project="${esc(project.name)}" aria-label="Add task to ${esc(project.name)}">+ Task</button></div></article>`).join('') || empty('Give a task a project name to keep a larger outcome moving.');
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
      if (!state.loaded.Tasks) { $('taskList').innerHTML = empty('Use Refresh to reconnect to your tasks.'); $('projects').innerHTML = empty('Projects will appear when tasks reconnect.'); }
      throw error;
    }
  });
}
async function updateTask(id, changes) {
  if (state.pending.has(id)) return false;
  const original = state.tasks.find(t => t.id === id);
  if (!original) return false;
  state.pending.add(id); state.revision++;
  const optimistic = {...original, ...changes};
  if (changes.status) optimistic.completedOn = changes.status === 'done' ? dayKey() : null;
  state.tasks = state.tasks.map(t => t.id === id ? optimistic : t); renderTasks();
  try {
    const data = await TaskStore.update({id, ...changes});
    state.tasks = state.tasks.map(t => t.id === id ? data.task : t);
    $('taskMessage').textContent = ''; return true;
  } catch (error) {
    state.tasks = state.tasks.map(t => t.id === id ? original : t);
    $('taskMessage').textContent = error.message;
    $('editError').textContent = error.message; toast('Save failed. The task was restored.'); return false;
  } finally { state.pending.delete(id); state.revision++; renderTasks(); }
}
function openEditor(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || state.pending.has(id)) return;
  $('editId').value = id; $('editName').value = task.name; $('editProject').value = task.project;
  $('editDue').value = dateDay(task.due); $('editFocus').checked = task.focus;
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
function facility(name, counter, hours) {
  const percent = counter?.percent, label = percent == null ? 'Occupancy unavailable' : `${percent}% · ${percent < 30 ? 'Quiet' : percent < 60 ? 'Moderate' : 'Busy'}`;
  const closed = hours?.closed ?? counter?.closed;
  const status = closed == null ? 'Status unavailable' : closed ? 'Closed' : 'Open';
  return `<div><div class="facility-title"><a href="https://www.purdue.edu/recwell/" target="_blank" rel="noopener">${name}</a><span class="badge ${closed === false ? 'open' : ''}" title="${esc(counter?.updated ? 'Latest count: '+counter.updated : 'No occupancy counter available')}">${status}${percent == null ? '' : ' · '+esc(label)}</span></div><div class="facility-meta">${esc(hours?.hours || 'Hours unavailable')} · ${name === 'CoRec' && counter ? 'fitness-area count' : percent == null ? 'occupancy unavailable' : 'pool count'}</div></div>`;
}
function renderRec(data) {
  $('recreation').innerHTML = facility('CoRec', data.spaces?.corec_lower, data.corec_hours) + facility('Aquatic', data.spaces?.aquatic, data.aquatic_hours);
}
function renderDining(data) {
  $('dining').innerHTML = data.courts.map(court => {
    const status = court.open === null ? 'Unavailable' : court.open ? 'Open' : 'Closed';
    const meal = court.meal ? `${court.open ? '' : 'Next: '}${court.date > dayKey() ? 'tomorrow ' : ''}${court.meal}` : '';
    return `<article class="dining-court"><div class="court-top"><div class="court-heading">${esc(court.name)} <span class="badge ${court.open ? 'open' : ''}">${status}</span></div><div class="court-meta">${esc(meal)}${court.start ? ` · ${esc(timeLabel(court.start))}–${esc(timeLabel(court.end))}` : ''}</div></div><div>${court.picks.map(p => `<div class="pick"><span>${esc(p.name)}</span><div class="macros" title="${esc(p.serving || 'Serving size unavailable')}">${p.protein == null ? 'Nutrition unavailable' : `<span class="protein">${p.protein}g P</span> · ${p.fat == null ? 'Fat unavailable' : p.fat+'g F'} · ${p.sodium == null ? 'Sodium unavailable' : p.sodium+'mg Na'}`}${p.serving ? ' · '+esc(p.serving.replace(/ Serving$/i,'')) : ''}</div></div>`).join('') || empty(court.message || 'No protein picks published.')}</div></article>`;
  }).join('');
}
const importantEvent = event => /exam|quiz|\bcfu\b|demonstration|practical|presentation|roundtable|meetup|break/i.test(`${event.name} ${event.type}`);
const routineEvent = event => !importantEvent(event) && (event.type === 'Class' || /\b(lecture|recitation|class meeting)\b/i.test(event.name));
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
  const relevant = state.events.filter(e => state.selectedDay ? eventOnDay(e, state.selectedDay) : eventIsFuture(e) && !routineEvent(e)).sort((a,b) => a.at.localeCompare(b.at));
  $('eventList').innerHTML = (state.selectedDay ? `<p class="section-note">${esc(shortDate(state.selectedDay))}</p>` : '') + (relevant.slice(0,30).map(e => `<div class="event-row"><small>${esc(eventLabel(e))}</small>${safeURL(e.url) ? `<a href="${esc(safeURL(e.url))}" target="_blank" rel="noopener">${esc(e.name)}</a>` : `<span class="event-name">${esc(e.name)}</span>`}</div>`).join('') || empty(state.selectedDay ? 'No events this day.' : 'No upcoming events beyond routine classes.'));
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
    const classes = ['day',day.slice(0,7)!==state.month?'other':'',day===dayKey()?'today':'',day===state.selectedDay?'selected':'',events.length?'has-events':'',events.some(importantEvent)?'important':''].join(' ');
    html += `<button class="${classes}" data-day="${day}" aria-label="${day}, ${events.length} events" aria-pressed="${day===state.selectedDay}" title="${esc(events.map(e=>e.name).join('\n') || 'No events')}">${date.getUTCDate()}</button>`;
  }
  $('calendarGrid').innerHTML = html;
}
async function loadCalendar() {
  return loadPanel('Calendar', async () => {
    try {
      const data = await CalendarProvider.load(); state.events = data.events.filter(e => e.at && Number.isFinite(dateObject(e.at).getTime()));
      $('calendarSource').textContent = `${data.source} · Checked ${timeLabel(data.updatedAt)}`; renderEvents();
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
function refreshAll() { return Promise.allSettled([loadTasks(),loadCalendar(),loadCampus()]); }
$('quickAdd').addEventListener('submit', async event => {
  event.preventDefault(); if (state.creating) return;
  const task = {name:$('taskName').value.trim(),project:$('taskProject').value.trim(),due:$('taskDue').value || null,focus:true};
  if (!task.name) return;
  state.creating = true; state.revision++; $('addButton').disabled = true; $('taskMessage').textContent = '';
  try {
    const data = await TaskStore.create(task); state.tasks.unshift(data.task);
    // Preserve anything typed while the request was in flight.
    if ($('taskName').value.trim() === task.name) { $('taskName').value = ''; $('taskDue').value = ''; }
    setTab('today'); $('taskName').focus(); toast('Task added to Today.');
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
$('editTask').addEventListener('submit', async event => {
  event.preventDefault(); const id=$('editId').value, original=state.tasks.find(t=>t.id===id);
  $('saveEdit').disabled=true;
  const changes={name:$('editName').value.trim(),project:$('editProject').value.trim(),course:$('editCourse').value,status:$('editStatus').value,focus:$('editFocus').checked};
  // Editing another field must not discard an imported deadline's time or offset.
  if ($('editDue').value !== dateDay(original.due)) changes.due=$('editDue').value || null;
  const saved=await updateTask(id,changes); $('saveEdit').disabled=false;
  if(saved) $('editDialog').close();
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
setInterval(()=>{if(!document.hidden) loadTasks();},CONFIG.taskRefresh);
setInterval(()=>{if(!document.hidden) loadCampus();},CONFIG.campusRefresh);
let currentDay=dayKey();
setInterval(()=>{clock();if(dayKey()!==currentDay){currentDay=dayKey();renderTasks();renderEvents();refreshAll();}},30000);
clock();renderCalendar();refreshAll();
