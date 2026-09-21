'use strict';
(() => {
  const {CONFIG,$,esc,safeURL,dayKey,dateDay,timeLabel,empty,request,renderFacilities}=NOcean;
  const state={tasks:[],projects:[],courses:[],statuses:[],tab:'today',pending:new Set(),loading:new Set(),events:[]};
  const tasks=NOceanData.tasks,projects=NOceanData.projects;
  let editingPlan=null,toastTimer;
  const tomorrow=()=>TaskPlanning.add(dayKey(),1);
  const dateFmt=new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,weekday:'long',month:'long',day:'numeric'});
  $('homeDate').textContent=dateFmt.format(new Date());

  function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function setLoading(name,on){if(on)state.loading.add(name);else state.loading.delete(name);$('syncStatus').textContent=state.loading.size?'Refreshing…':'Up to date';}
  function dueText(value){return value?Deadlines.label(value):'';}
  function plannedFor(task,tab){
    if(task.status==='done')return false;
    if(tab==='today')return task.status==='doing'||task.focus||(task.planningMode==='planned'&&task.scheduledFor===dayKey());
    if(tab==='tomorrow')return task.planningMode==='planned'&&task.scheduledFor===tomorrow();
    return task.planningMode==='backlog';
  }
  function taskRow(task){
    const busy=state.pending.has(task.id),due=dueText(task.due);
    return `<article class="task-row" data-task-id="${esc(task.id)}"><input type="checkbox" data-complete="${esc(task.id)}" ${busy?'disabled':''} aria-label="Complete ${esc(task.name)}"><div class="task-text"><button class="task-name quiet" data-edit="${esc(task.id)}" ${busy?'disabled':''}>${esc(task.name)}</button><div class="task-meta">${task.course||task.project?`<span>${esc(task.course||task.project)}</span>`:''}${task.difficulty&&task.difficulty!=='Unrated'?`<span>${esc(task.difficulty)}</span>`:''}${due?`<span>Due ${esc(due)}</span>`:''}</div></div>${task.focus?'<span class="focus-button on">● Focus</span>':''}</article>`;
  }
  function renderTasks(){
    document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.setAttribute('aria-pressed',String(b.dataset.tab===state.tab));});
    const visible=state.tasks.filter(t=>plannedFor(t,state.tab)).sort((a,b)=>Number(b.status==='doing')-Number(a.status==='doing')||(a.scheduledFor||a.due||'9999').localeCompare(b.scheduledFor||b.due||'9999'));
    $('tasksTitle').textContent={today:'Today',tomorrow:'Tomorrow',later:'Backlog'}[state.tab];
    $('taskCount').textContent=`${visible.length} planned`;
    $('taskList').innerHTML=visible.map(taskRow).join('')||empty(state.tab==='today'?'No deliberate work yet. Add the next thing you will actually do.':'Nothing planned here.');
    $('taskHint').textContent={today:'Focused, doing, or explicitly planned for today — deadlines live above.',tomorrow:'A deliberate plan for tomorrow; moving work never changes its deadline.',later:'Work intentionally held in the backlog.'}[state.tab];
    updateLifeStatus();
  }
  function courseKey(value){const m=String(value||'').toUpperCase().match(/([A-Z]{2,5})\s*0*(\d{3,5})/);return m?m[1]+Number(m[2]):String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function renderRadar(){
    const classes=NOceanStore.settings().classes,today=dayKey();let total=0,open=0;
    $('academicRadar').innerHTML=classes.map(course=>{
      const key=courseKey(course);
      const work=state.tasks.filter(t=>t.due&&dateDay(t.due)>=today&&courseKey(t.course)===key).sort((a,b)=>a.due.localeCompare(b.due));
      total+=work.length;open+=work.filter(t=>NOceanStore.verification(t)!=='verified').length;
      return `<article class="class-radar"><div class="class-radar-head"><h3>${esc(course)}</h3><span>${work.length?work.length+' ahead':'Clear'}</span></div>${work.slice(0,4).map(t=>{const verification=NOceanStore.verification(t),source=t.sourceId?.startsWith('brightspace:')?'Brightspace':'Course task';return `<div class="coursework-item ${verification==='verified'?'is-verified':''}"><span class="coursework-title">${safeURL(t.sourceUrl)?`<a href="${esc(safeURL(t.sourceUrl))}" target="_blank" rel="noopener">${esc(t.name)}</a>`:esc(t.name)}</span><div class="coursework-meta"><span>${esc(dueText(t.due))} · ${source}${t.status==='done'?' · work done':''}</span><select class="coursework-state" data-verify="${esc(t.id)}" aria-label="Submission state for ${esc(t.name)}"><option value="pending" ${verification==='pending'?'selected':''}>Not submitted</option><option value="submitted" ${verification==='submitted'?'selected':''}>Submitted</option><option value="verified" ${verification==='verified'?'selected':''}>Verified</option></select></div></div>`;}).join('')||'<p class="coursework-empty">No future coursework on the radar.</p>'}</article>`;
    }).join('')||'<p class="empty">Add current classes in Settings.</p>';
    $('academicSummary').textContent=`${classes.length} classes · ${open} to verify`;
    $('academicRadar').dataset.total=String(total);$('academicRadar').dataset.open=String(open);updateLifeStatus();
  }
  function updateLifeStatus(){
    const academic=Number($('academicRadar').dataset.open||0),planned=state.tasks.filter(t=>plannedFor(t,'today')).length,maintenance=NOceanStore.maintenanceStatus(dayKey()).filter(x=>x.isDue&&!x.completedToday).length;
    if(!state.tasks.length&&!$('academicRadar').dataset.open){$('lifeStatus').textContent='Loading today’s signal…';return;}
    const pieces=[`${academic} coursework check${academic===1?'':'s'}`,`${planned} task${planned===1?'':'s'} planned`];if(maintenance)pieces.push(`${maintenance} maintenance due`);
    $('lifeStatus').textContent=pieces.join(' · ')+(academic||maintenance?' — something still needs confirmation.':' — clear on the tracked signals.');
  }
  async function loadCore(){
    setLoading('core',true);$('taskMessage').textContent='';
    const [taskResult,projectResult]=await Promise.allSettled([tasks.list(),projects.list()]);
    if(taskResult.status==='fulfilled'){state.tasks=taskResult.value.tasks;state.courses=taskResult.value.courses;state.statuses=taskResult.value.statuses;renderTasks();renderRadar();}
    else{$('taskMessage').textContent='Tasks unavailable. Refresh to reconnect.';$('taskList').innerHTML=empty('Your work plan could not load.');}
    if(projectResult.status==='fulfilled'){state.projects=projectResult.value.projects;$('projectOptions').innerHTML=state.projects.filter(p=>p.status==='Active').map(p=>`<option value="${esc(p.name)}"></option>`).join('');}
    setLoading('core',false);
  }
  async function updateTask(id,changes){
    if(state.pending.has(id))return false;const original=state.tasks.find(t=>t.id===id);if(!original)return false;
    state.pending.add(id);state.tasks=state.tasks.map(t=>t.id===id?{...t,...changes}:t);renderTasks();renderRadar();
    try{const result=await tasks.update({id,...changes});state.tasks=state.tasks.map(t=>t.id===id?result.task:t);renderTasks();renderRadar();return true;}
    catch(error){state.tasks=state.tasks.map(t=>t.id===id?original:t);$('taskMessage').textContent=error.message;renderTasks();renderRadar();return false;}
    finally{state.pending.delete(id);renderTasks();}
  }
  function openEditor(id){
    const task=state.tasks.find(t=>t.id===id);if(!task)return;const d=Deadlines.fields(task.due);
    $('editId').value=id;$('editName').value=task.name;$('editProject').value=task.project||'';$('editDue').value=d.date;$('editTime').value=d.time;$('editDifficulty').value=task.difficulty||'Unrated';$('editFocus').checked=task.focus;
    $('editCourse').innerHTML='<option value="">None</option>'+[...new Set([...state.courses,task.course].filter(Boolean))].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('editCourse').value=task.course||'';$('editError').textContent='';editingPlan=null;
    document.querySelectorAll('#editDialog [data-plan]').forEach(b=>b.classList.remove('active'));$('editDialog').showModal();
  }
  function weatherCode(code){return ({0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Cloudy',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorms'})[code]||'Mixed conditions';}
  function rainWindow(data,index,threshold){
    const date=data.daily.time[index],times=data.hourly?.time||[],rain=data.hourly?.precipitation_probability||[],hours=[];
    times.forEach((time,i)=>{if(time.startsWith(date)&&Number(rain[i])>=threshold)hours.push({time,prob:Number(rain[i])});});
    if(!hours.length)return 'No meaningful rain window';
    const start=new Date(hours[0].time),end=new Date(hours.at(-1).time);end.setHours(end.getHours()+1);const fmt=d=>new Intl.DateTimeFormat('en-US',{hour:'numeric'}).format(d);
    return `${fmt(start)}–${fmt(end)} · up to ${Math.max(...hours.map(x=>x.prob))}%`;
  }
  function renderWeather(data){
    const prefs=NOceanStore.settings().dashboard,fmt=n=>Math.round(Number(n)),threshold=Math.max(10,Math.min(90,Number(prefs.rainThreshold)||35));
    const current=fmt(data.current.temperature_2m),todayRain=rainWindow(data,0,threshold),tomorrowRain=rainWindow(data,1,threshold),highs=data.daily.temperature_2m_max,lows=data.daily.temperature_2m_min;
    const delta=fmt(highs[1]-highs[0]),decision=tomorrowRain.startsWith('No meaningful')?(Math.abs(delta)>=8?`Tomorrow’s high is ${Math.abs(delta)}° ${delta>0?'warmer':'cooler'} than today.`:'No major weather swing between today and tomorrow.'):`Plan around rain tomorrow: ${tomorrowRain}.`;
    $('weather').innerHTML=`<div class="forecast-grid"><article class="forecast-day"><strong>Today · ${esc(weatherCode(data.current.weather_code))}</strong><div class="forecast-temp">${current}°</div><div class="forecast-detail">High ${fmt(highs[0])}° · Low ${fmt(lows[0])}°<br>Rain: ${esc(todayRain)}</div></article><article class="forecast-day"><strong>Tomorrow · ${esc(weatherCode(data.daily.weather_code?.[1]))}</strong><div class="forecast-temp">${fmt(highs[1])}° <span class="muted">high</span></div><div class="forecast-detail">Low ${fmt(lows[1])}°<br>Rain: ${esc(tomorrowRain)}</div></article></div><p class="forecast-decision">${esc(decision)}</p>`;
  }
  function renderDining(data){
    if(!NOceanStore.settings().dashboard.showDining){$('diningBrief').hidden=true;return;}$('diningBrief').hidden=false;
    const meal=new Date().getHours()<15?'Lunch':'Dinner',courts=data.meals?.[meal]||[],court=courts.find(x=>x.open&&x.picks?.length)||courts.find(x=>x.picks?.length),pick=court?.picks?.[0];
    $('dining').innerHTML=court&&pick?`<p class="dining-tip"><strong>${esc(court.name)}:</strong> ${esc(pick.name)}${pick.protein!=null?` · ${esc(pick.protein)}g protein`:''}. <a href="https://dining.purdue.edu/menus/" target="_blank" rel="noopener">Menus ↗</a></p>`:empty('No useful dining signal right now.');
  }
  async function loadCampus(){
    setLoading('campus',true);const [w,r,d]=await Promise.allSettled([request(CONFIG.weather),request('/api/recwell'),request('/api/dining')]);
    if(w.status==='fulfilled')renderWeather(w.value);else $('weather').innerHTML=empty('Forecast unavailable.');
    if(r.status==='fulfilled')$('recreation').innerHTML=renderFacilities(r.value);else $('recreation').innerHTML=empty('Facility status unavailable.');
    if(d.status==='fulfilled')renderDining(d.value);else $('dining').innerHTML=empty('Dining signal unavailable.');setLoading('campus',false);
  }
  function eventWhen(value){const d=new Date(value.length===10?value+'T12:00:00':value),key=dateDay(value);if(key===dayKey())return value.length===10?'Today':'Today · '+timeLabel(value);if(key===tomorrow())return value.length===10?'Tomorrow':'Tomorrow · '+timeLabel(value);return new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,weekday:'short',month:'short',day:'numeric',...(value.length>10?{hour:'numeric',minute:'2-digit'}:{})}).format(d);}
  async function loadEvents(){
    setLoading('events',true);try{const data=await request('/api/events'),now=Date.now(),count=Math.max(3,Math.min(10,Number(NOceanStore.settings().dashboard.eventCount)||6));state.events=data.events||[];
      const future=state.events.filter(e=>{try{return new Date(e.at.length===10?e.at+'T23:59:00':e.at).getTime()>=now;}catch{return false;}}).sort((a,b)=>a.at.localeCompare(b.at));
      const important=future.filter(e=>CalendarSemantics.classify(e).key!=='class'),chosen=[...important,...future.filter(e=>CalendarSemantics.classify(e).key==='class')].filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i).slice(0,count).sort((a,b)=>a.at.localeCompare(b.at));
      $('eventList').innerHTML=chosen.map(e=>`<div class="event-row"><small>${esc(eventWhen(e.at))} · ${esc(CalendarSemantics.classify(e).short||CalendarSemantics.classify(e).label)}</small>${safeURL(e.url)?`<a class="event-name" href="${esc(safeURL(e.url))}" target="_blank" rel="noopener">${esc(e.name)}</a>`:`<span class="event-name">${esc(e.name)}</span>`}</div>`).join('')||empty('No upcoming events.');$('calendarSource').textContent=data.source||'Calendar';
    }catch{$('eventList').innerHTML=empty('Calendar unavailable.');$('calendarSource').textContent='Use Open calendar to check directly.';}finally{setLoading('events',false);}
  }
  function refresh(){loadCore();loadCampus();loadEvents();}
  $('quickAdd').addEventListener('submit',async event=>{event.preventDefault();const name=$('taskName').value.trim();if(!name)return;$('addButton').disabled=true;try{const result=await tasks.create({name,project:$('taskProject').value.trim(),difficulty:$('taskDifficulty').value,due:Deadlines.serialize($('taskDue').value,$('taskTime').value),focus:true,...TaskPlanning.change('today')});state.tasks.unshift(result.task);$('taskName').value='';$('taskDue').value='';$('taskTime').value='';renderTasks();renderRadar();notify('Added to today.');}catch(error){$('taskMessage').textContent=error.message;}finally{$('addButton').disabled=false;}});
  document.querySelector('.tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(button){state.tab=button.dataset.tab;renderTasks();}});
  $('taskList').addEventListener('click',event=>{const button=event.target.closest('[data-edit]');if(button)openEditor(button.dataset.edit);});
  $('taskList').addEventListener('change',event=>{if(event.target.dataset.complete)updateTask(event.target.dataset.complete,{status:'done'});});
  $('academicRadar').addEventListener('change',event=>{const select=event.target.closest('[data-verify]');if(!select)return;const task=state.tasks.find(t=>t.id===select.dataset.verify);if(task){NOceanStore.setVerification(task,select.value);renderRadar();notify(select.value==='verified'?'Submission verified.':'Submission state saved.');}});
  document.querySelector('.plan-actions').addEventListener('click',event=>{const button=event.target.closest('[data-plan]');if(!button)return;editingPlan=button.dataset.plan;document.querySelectorAll('#editDialog [data-plan]').forEach(b=>b.classList.toggle('active',b===button));});
  $('editTask').addEventListener('submit',async event=>{event.preventDefault();const id=$('editId').value,changes={name:$('editName').value.trim(),project:$('editProject').value.trim(),course:$('editCourse').value,difficulty:$('editDifficulty').value,focus:$('editFocus').checked,due:Deadlines.serialize($('editDue').value,$('editTime').value)};if(editingPlan)Object.assign(changes,TaskPlanning.change(editingPlan));$('saveEdit').disabled=true;if(await updateTask(id,changes)){$('editDialog').close();notify('Task saved.');}$('saveEdit').disabled=false;});
  $('archiveTask').addEventListener('click',async()=>{const id=$('editId').value;try{await tasks.archive(id);state.tasks=state.tasks.filter(t=>t.id!==id);$('editDialog').close();renderTasks();renderRadar();notify('Task archived.');}catch(error){$('editError').textContent=error.message;}});
  $('closeEdit').onclick=$('cancelEdit').onclick=()=>$('editDialog').close();$('refresh').addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))refresh();});
  refresh();
})();
