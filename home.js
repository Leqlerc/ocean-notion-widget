'use strict';
(() => {
  const {CONFIG,$,esc,safeURL,dayKey,dateDay,timeLabel,empty,request,occupancyLevel,renderFacilities}=NOcean;
  const state={tasks:[],projects:[],courses:[],statuses:[],tab:'today',pending:new Set(),loading:new Set(),events:[],selectedDay:dayKey(),calendarMonth:dayKey().slice(0,7),lingering:new Set(),lingerTabs:new Map(),rowPositions:new Map(),removalTimers:new Map()};
  const tasks=NOceanData.tasks,projects=NOceanData.projects;
  let editingPlan=null,toastTimer,taskRevision=0,coreRequest=0,creating=false;
  const tomorrow=()=>TaskPlanning.add(dayKey(),1);
  const dateFmt=new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,weekday:'long',month:'long',day:'numeric'});
  $('homeDate').textContent=dateFmt.format(new Date());
  const quotes=['Take the next clear step.','Steady work makes room for good days.','A little progress still changes the shape of the day.','Make it simple, then make it real.','Attention is a direction—choose it kindly.','Start where your feet are.','Good work can be quiet and still count.','Leave a little room for wonder.','One useful thing is enough to begin.','Move with purpose, not pressure.'];
  function renderGreeting(now=new Date()){
    const hour=now.getHours(),period=hour>=5&&hour<12?'morning':hour>=12&&hour<17?'afternoon':'evening';
    const localDay=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    let hash=0;for(const char of localDay)hash=(hash*31+char.charCodeAt(0))>>>0;
    $('homeHeading').textContent=`Good ${period}, Will`;$('homeSubtitle').textContent=quotes[hash%quotes.length];
  }
  renderGreeting();

  function notify(text,undo){const node=$('toast');node.replaceChildren(document.createTextNode(text));if(undo){const button=document.createElement('button');button.type='button';button.className='quiet';button.textContent='Undo';button.onclick=()=>{node.hidden=true;undo();};node.append(button);}node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,7000);}
  function setLoading(name,on){if(on)state.loading.add(name);else state.loading.delete(name);$('syncStatus').textContent=state.loading.size?'Refreshing…':'Up to date';}
  function dueText(value){return value?Deadlines.label(value):'';}
  function overdue(value){return value&&(value.length===10?dateDay(value)<dayKey():new Date(value).getTime()<Date.now());}
  function dueBadge(value){
    if(!value)return '';
    const day=dateDay(value),label=overdue(value)?'OVERDUE':day===dayKey()?'DUE TODAY':day===tomorrow()?'DUE TOMORROW':'DUE '+new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,...(day<TaskPlanning.add(dayKey(),7)?{weekday:'short'}:{month:'short',day:'numeric'})}).format(new Date(value.length===10?value+'T12:00:00':value)).toUpperCase();
    return `<span class="due-badge ${overdue(value)?'is-overdue':day===dayKey()?'is-due-today':''}" title="${esc(dueText(value))}">${esc(label)}</span>`;
  }
  function applyLayout(){
    const prefs=NOceanStore.settings().dashboard;
    document.querySelectorAll('[data-home-module]').forEach(node=>{node.hidden=prefs[node.dataset.homeModule]===false;});
    const side=$('homeSide');side.hidden=prefs.showEvents===false;
    const columns=[prefs.showTasks!==false?'1.35fr':'',prefs.showDeadlines!==false?'1.2fr':'',!side.hidden?'.85fr':''].filter(Boolean);
    document.querySelector('.dashboard').style.setProperty('--home-columns',columns.map(x=>`minmax(0,${x})`).join(' ')||'minmax(0,1fr)');
    document.querySelector('.dashboard').style.setProperty('--home-mid-columns',Math.max(1,Number(prefs.showTasks!==false)+Number(prefs.showDeadlines!==false)));
    document.querySelector('.campus-grid').style.setProperty('--campus-columns',Math.max(1,['showWeather','showFacilities','showDining'].filter(key=>prefs[key]!==false).length));
  }
  function plannedFor(task,tab){
    if(task.status==='done')return state.lingering.has(task.id)&&state.lingerTabs.get(task.id)===tab;
    return TaskPlanning.matches(task,tab,dayKey());
  }
  function taskRow(task){
    const busy=state.pending.has(task.id),due=dueText(task.due),done=task.status==='done',difficulty=String(task.difficulty||'Unrated').toLowerCase();
    return `<article class="task-row difficulty-${esc(difficulty)} ${done?'done':''}" data-task-id="${esc(task.id)}"><input type="checkbox" data-complete="${esc(task.id)}" ${done?'checked':''} ${busy?'disabled':''} aria-label="${done?'Reopen':'Complete'} ${esc(task.name)}"><div class="task-text"><button class="task-name quiet" data-edit="${esc(task.id)}" ${busy?'disabled':''}>${esc(task.name)}</button><div class="task-meta">${task.course||task.project?`<span>${esc(task.course||task.project)}</span>`:''}${task.difficulty&&task.difficulty!=='Unrated'?`<span class="difficulty-indicator difficulty-${esc(difficulty)}">${esc(task.difficulty)}</span>`:''}${due?`<span>Due ${esc(due)}</span>`:''}</div></div><div class="task-row-actions">${!done?`${dueBadge(task.due)}<button type="button" class="focus-button ${task.focus?'on':''}" data-focus="${esc(task.id)}" aria-pressed="${Boolean(task.focus)}" aria-label="Toggle focus for ${esc(task.name)}" ${busy?'disabled':''}>${task.focus?'●':'○'} Focus</button>${state.tab!=='today'?`<button type="button" class="plan-today" data-today="${esc(task.id)}" ${busy?'disabled':''} aria-label="Plan ${esc(task.name)} for Today">+ Today</button>`:''}`:''}</div></article>`;
  }
  function visibleTasks(tab=state.tab){
    const visible=state.tasks.filter(t=>plannedFor(t,tab)).sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||Number(b.status==='doing')-Number(a.status==='doing')||(a.scheduledFor||a.due||'9999').localeCompare(b.scheduledFor||b.due||'9999'));
    for(const id of state.lingering)if(state.lingerTabs.get(id)===tab){const at=visible.findIndex(t=>t.id===id);if(at>=0){const [task]=visible.splice(at,1);visible.splice(Math.min(state.rowPositions.get(id)??at,visible.length),0,task);}}
    return visible;
  }
  function renderTasks(){
    document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.setAttribute('aria-pressed',String(b.dataset.tab===state.tab));});
    const visible=visibleTasks();
    $('tasksTitle').textContent={today:'Today',tomorrow:'Tomorrow',upcoming:'Upcoming',later:'Backlog'}[state.tab];
    $('taskCount').textContent=`${visible.filter(t=>t.status!=='done').length} planned`;
    const blank=empty(state.tab==='today'?'No deliberate work yet. Add the next thing you will actually do.':'Nothing planned here.');
    if(typeof TaskMotion!=='undefined')TaskMotion.render($('taskList'),visible,taskRow,blank);else $('taskList').innerHTML=visible.map(taskRow).join('')||blank;
    $('taskHint').textContent={today:'Today’s plan and automatic work due today or overdue.',tomorrow:'Tomorrow’s plan and automatic work due tomorrow.',upcoming:'Work planned or due in 2–14 days. Planning never moves the deadline.',later:'Backlog, undated work, and work beyond the next two weeks.'}[state.tab];
    $('addButton').textContent={today:'Add to today',tomorrow:'Add to tomorrow',upcoming:'Add automatic',later:'Add to backlog'}[state.tab];
    updateLifeStatus();
  }
  function courseKey(value){const m=String(value||'').toUpperCase().match(/([A-Z]{2,5})\s*0*(\d{3,5})/);return m?m[1]+Number(m[2]):String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function radarItems(work){
    return work.map(t=>{const submitted=NOceanStore.verification(t)==='submitted',source=t.sourceId?.startsWith('brightspace:')?'Brightspace':'Tracked assignment';return `<div class="coursework-item ${submitted?'is-submitted':'is-pending'}"><span class="coursework-title">${safeURL(t.sourceUrl)?`<a href="${esc(safeURL(t.sourceUrl))}" target="_blank" rel="noopener">${esc(t.name)}</a>`:esc(t.name)}</span><div class="coursework-meta"><span>${esc(t.course||'Coursework')} · ${esc(dueText(t.due))}${!submitted&&overdue(t.due)?' · OVERDUE':''} · ${source}${t.status==='done'?' · work done':''}</span><button type="button" class="coursework-state" data-verify="${esc(t.id)}" aria-pressed="${submitted}" ${state.pending.has(t.id)?'disabled':''} aria-label="${submitted?'Undo submission for':'Mark submitted:'} ${esc(t.name)}">${submitted?'✓ Submitted · Undo':'Mark submitted'}</button></div></div>`;}).join('')||'<p class="coursework-empty">No coursework on the radar.</p>';
  }
  function renderRadar(){
    const classes=NOceanStore.settings().classes,today=dayKey(),groups=new Map(classes.map(course=>[courseKey(course),{course,work:[]} ])),all=[];let total=0,open=0;
    for(const task of state.tasks){
      if(!task.due||!NOceanStore.isRadarItem(task))continue;
      const submitted=NOceanStore.verification(task)==='submitted';
      if(submitted&&dateDay(task.due)<TaskPlanning.add(today,-2))continue;
      // Old completed work remains in Tasks, without crowding the daily deadline view.
      // This display horizon never changes its submission confirmation.
      if(task.status==='done'&&dateDay(task.due)<TaskPlanning.add(today,-14))continue;
      const course=task.course||'Other coursework',key=courseKey(course);
      if(!groups.has(key))groups.set(key,{course,work:[]});
      groups.get(key).work.push(task);all.push(task);total++;if(!submitted)open++;
    }
    const mode=$('deadlineView')?.value||'date';
    let content='';
    if(mode==='class'){
      const nearest=group=>group.work.filter(t=>NOceanStore.verification(t)==='pending').map(t=>t.due).sort()[0]||'9999';
      content=[...groups.values()].filter(group=>group.work.length).sort((a,b)=>nearest(a).localeCompare(nearest(b))).map(({course,work})=>{
        work.sort((a,b)=>a.due.localeCompare(b.due)||Number(NOceanStore.verification(a)==='submitted')-Number(NOceanStore.verification(b)==='submitted'));
        const prefs=NOceanStore.settings().dashboard,key=courseKey(course),collapsed=Boolean(prefs.collapsedCourses?.[key]),pending=work.filter(t=>NOceanStore.verification(t)==='pending'),late=pending.filter(t=>overdue(t.due)).length;
        const limit=['today','1','3','5','all'].includes(String(prefs.deadlineCount))?String(prefs.deadlineCount):'3';
        const visible=limit==='today'?work.filter(t=>dateDay(t.due)===today):limit==='all'?work:work.slice(0,Number(limit)),extra=work.length-visible.length;
        return `<article class="class-radar"><button type="button" class="class-radar-head" data-course-toggle="${esc(key)}" aria-expanded="${!collapsed}" aria-controls="course-${esc(key)}"><strong>${collapsed?'▸':'▾'} ${esc(course)}</strong><span>${pending.length} upcoming${late?` · <b class="overdue-text">${late} overdue</b>`:''}${pending[0]?`<small>Next · ${esc(dueText(pending[0].due))}</small>`:''}</span></button><div id="course-${esc(key)}" class="course-radar-body" ${collapsed?'hidden':''}>${radarItems(visible)}${extra?`<p class="coursework-later">+${extra} ${limit==='today'?'outside today':'later'}</p>`:''}</div></article>`;
      }).join('');
    }else{
      all.sort((a,b)=>a.due.localeCompare(b.due)||Number(NOceanStore.verification(a)==='submitted')-Number(NOceanStore.verification(b)==='submitted')||String(a.name||'').localeCompare(String(b.name||'')));
      content=radarItems(all);
    }
    $('academicRadar').innerHTML=content||'<p class="empty">No tracked coursework deadlines.</p>';
    $('academicSummary').textContent=`${classes.length} classes · ${open} need confirmation`;
    $('academicRadar').dataset.total=String(total);$('academicRadar').dataset.open=String(open);updateLifeStatus();
  }
  function calendarItems(day){
    const deadlines=state.tasks.filter(t=>t.due&&dateDay(t.due)===day&&NOceanStore.isRadarItem(t)&&NOceanStore.verification(t)==='pending');
    const deadlineIds=new Set(deadlines.map(t=>t.id));
    const work=state.tasks.filter(t=>t.status!=='done'&&!deadlineIds.has(t.id)&&(t.scheduledFor===day||dateDay(t.due)===day));
    const events=state.events.filter(e=>e.at&&dateDay(e.at)===day);
    return {deadlines,work,events};
  }
  function renderCalendar(){
    const monthDate=new Date(state.calendarMonth+'-01T12:00:00'),year=monthDate.getFullYear(),month=monthDate.getMonth();
    const firstDay=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
    $('calendarLabel').textContent=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(monthDate);
    let html='';for(let i=0;i<firstDay;i++)html+='<span class="calendar-blank" aria-hidden="true"></span>';
    for(let day=1;day<=days;day++){
      const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,items=calendarItems(key),workload=items.deadlines.length+items.work.length,level=CalendarSemantics.workloadLevel(workload),events=items.events.length;
      const dateLabel=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date(key+'T12:00:00'));
      const workloadLabel=`${workload} workload item${workload===1?'':'s'}`,eventLabel=`${events} calendar event${events===1?'':'s'}`,accessible=`${dateLabel} · ${workloadLabel} · ${eventLabel}`;
      html+=`<button type="button" class="calendar-day workload-${level}${key===dayKey()?' is-today':''}${key===state.selectedDay?' is-selected':''}" data-calendar-day="${key}" data-workload-count="${workload}" aria-label="${esc(accessible)}" title="${esc(accessible)}"><span>${day}</span>${workload?`<i aria-hidden="true">${Math.min(workload,9)}</i>`:''}${events?'<i class="calendar-event-dot" aria-hidden="true">•</i>':''}</button>`;
    }
    $('calendarGrid').innerHTML=html;
    const items=calendarItems(state.selectedDay),label=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric'}).format(new Date(state.selectedDay+'T12:00:00'));
    const rows=[
      ...items.deadlines.map(t=>`<div class="agenda-row agenda-deadline"><small>Deadline · ${esc(t.course||'Course')}</small><strong>${esc(t.name)}</strong></div>`),
      ...items.events.map(e=>`<div class="agenda-row"><small>${esc(eventWhen(e.at))} · ${esc(CalendarSemantics.classify(e).short||CalendarSemantics.classify(e).label)}</small>${safeURL(e.url)?`<a href="${esc(safeURL(e.url))}" target="_blank" rel="noopener">${esc(e.name)}</a>`:`<strong>${esc(e.name)}</strong>`}</div>`),
      ...items.work.map(t=>`<div class="agenda-row"><small>Task${t.project?' · '+esc(t.project):''}</small><strong>${esc(t.name)}</strong></div>`)
    ];
    $('calendarAgenda').innerHTML=`<h3>${esc(label)}</h3>${rows.join('')||empty('Nothing tracked for this date.')}`;
  }
  function moveCalendar(delta){
    const date=new Date(state.calendarMonth+'-01T12:00:00');date.setMonth(date.getMonth()+delta);state.calendarMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;state.selectedDay=state.calendarMonth+'-01';renderCalendar();
  }
  function updateLifeStatus(){
    const academic=Number($('academicRadar').dataset.open||0),planned=state.tasks.filter(t=>plannedFor(t,'today')).length,maintenance=NOceanStore.maintenanceStatus(dayKey()).filter(x=>x.isDue&&!x.completedToday).length;
    if(!state.tasks.length&&!$('academicRadar').dataset.open){$('lifeStatus').textContent='Loading today’s signal…';return;}
    const pieces=[`${academic} coursework check${academic===1?'':'s'}`,`${planned} task${planned===1?'':'s'} planned`];if(maintenance)pieces.push(`${maintenance} maintenance due`);
    $('lifeStatus').textContent=pieces.join(' · ')+(academic||maintenance?' — something still needs confirmation.':' — clear on the tracked signals.');
  }
  async function loadCore(){
    if(state.pending.size||creating)return;
    const revision=taskRevision,requestId=++coreRequest;
    setLoading('core',true);$('taskMessage').textContent='';
    const [taskResult,projectResult]=await Promise.allSettled([tasks.list(),projects.list()]);
    if(revision!==taskRevision||requestId!==coreRequest||state.pending.size||creating){setLoading('core',false);return;}
    if(taskResult.status==='fulfilled'){state.tasks=taskResult.value.tasks;state.courses=taskResult.value.courses;state.statuses=taskResult.value.statuses;renderTasks();renderRadar();renderCalendar();}
    else{$('taskMessage').textContent='Tasks unavailable. Refresh to reconnect.';$('taskList').innerHTML=empty('Your work plan could not load.');}
    if(projectResult.status==='fulfilled'){state.projects=projectResult.value.projects;$('projectOptions').innerHTML=state.projects.filter(p=>p.status==='Active').map(p=>`<option value="${esc(p.name)}"></option>`).join('');}
    setLoading('core',false);
  }
  async function updateTask(id,changes,allowUndo=true){
    if(state.pending.has(id))return false;const original=state.tasks.find(t=>t.id===id);if(!original)return false;
    taskRevision++;
    clearTimeout(state.removalTimers.get(id));state.removalTimers.delete(id);
    const completing=changes.status==='done'&&original.status!=='done',started=Date.now();
    if(completing){state.rowPositions.set(id,visibleTasks().findIndex(t=>t.id===id));state.lingering.add(id);state.lingerTabs.set(id,state.tab);}
    if(changes.status!=='done'){state.lingering.delete(id);state.lingerTabs.delete(id);state.rowPositions.delete(id);}
    state.pending.add(id);state.tasks=state.tasks.map(t=>t.id===id?{...t,...changes,...('status' in changes?{completedOn:changes.status==='done'?dayKey():null}:{})}:t);renderTasks();renderRadar();renderCalendar();
    try{const result=await tasks.update({id,...changes});state.tasks=state.tasks.map(t=>t.id===id?result.task:t);
      if(completing){const remove=()=>{state.lingering.delete(id);state.lingerTabs.delete(id);state.rowPositions.delete(id);state.removalTimers.delete(id);renderTasks();};state.removalTimers.set(id,setTimeout(remove,Math.max(0,3000-(Date.now()-started))));notify('Task completed.',allowUndo?()=>updateTask(id,{status:original.status},false):null);}
      renderTasks();renderRadar();renderCalendar();return true;}
    catch(error){state.lingering.delete(id);state.lingerTabs.delete(id);state.rowPositions.delete(id);state.tasks=state.tasks.map(t=>t.id===id?original:t);$('taskMessage').textContent=error.message;notify('Save failed. The task was restored.');renderTasks();renderRadar();renderCalendar();return false;}
    finally{state.pending.delete(id);renderTasks();renderRadar();}
  }
  function openEditor(id){
    const task=state.tasks.find(t=>t.id===id);if(!task)return;const d=Deadlines.fields(task.due);
    $('editId').value=id;$('editName').value=task.name;$('editProject').value=task.project||'';$('editDue').value=d.date;$('editTime').value=d.time;$('editDifficulty').value=task.difficulty||'Unrated';$('editFocus').checked=task.focus;
    const brightspace=String(task.sourceId||'').startsWith('brightspace:');$('editRadar').checked=NOceanStore.isRadarItem(task);$('editRadar').disabled=brightspace;$('editRadar').title=brightspace?'Brightspace coursework is always tracked on Academic Radar.':'Only enable this for a real class assignment or obligation.';
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
    const now=Date.now(),all=Object.values(data.meals||{}).flat(),meal=new Date().getHours()<15?'Lunch':'Dinner',courts=all,format=value=>value?new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(value)):'',names=['Wiley','Windsor'];
    $('dining').innerHTML=names.map(name=>{const court=courts.filter(x=>String(x.name||'').toLowerCase().includes(name.toLowerCase())).sort((a,b)=>{const rank=c=>c.start&&c.end?(new Date(c.start)<=now&&now<new Date(c.end)?0:new Date(c.start)>now?1:2):3;return rank(a)-rank(b)||(a.start||'').localeCompare(b.start||'');})[0],pick=court?.picks?.[0],percent=court?.crowd?.percent,level=court?.open===true?occupancyLevel(percent):0,hours=court?.start&&court?.end?`${format(court.start)}–${format(court.end)}`:`${meal} hours unavailable`,stateLabel=court?.open===true?'Open':court?.open===false?'Closed':'Status unavailable',food=pick?`${esc(pick.name)} · ${pick.protein!=null?esc(pick.protein)+'g P':'P unavailable'} · ${pick.fat!=null?esc(pick.fat)+'g F':'F unavailable'} · ${pick.proteinFatRatio!=null?esc(pick.proteinFatRatio)+' P:F':pick.fat===0?'P:F ≥'+esc(pick.protein||0)+' (0g F reported)':'P:F unavailable'}`:esc(court?.message||'Protein-forward item unavailable');return `<article class="facility-status dining-court occupancy-${level}"><div class="facility-title"><a href="https://dining.purdue.edu/menus/" target="_blank" rel="noopener">${name}</a><span class="facility-state">${stateLabel}</span></div><div class="facility-meta"><span>${esc(hours)}</span><span>${percent==null?'Occupancy unavailable':esc(percent)+'%'}</span></div><strong class="dining-pick">${food}</strong></article>`;}).join('');
  }
  async function loadCampus(){
    setLoading('campus',true);const [w,r,d]=await Promise.allSettled([request(CONFIG.weather),request('/api/recwell'),request('/api/dining')]);
    if(w.status==='fulfilled')renderWeather(w.value);else $('weather').innerHTML=empty('Forecast unavailable.');
    if(r.status==='fulfilled')$('recreation').innerHTML=renderFacilities(r.value);else $('recreation').innerHTML=empty('Facility status unavailable.');
    if(d.status==='fulfilled')renderDining(d.value);else $('dining').innerHTML=empty('Dining signal unavailable.');setLoading('campus',false);
  }
  function eventWhen(value){const d=new Date(value.length===10?value+'T12:00:00':value),key=dateDay(value);if(key===dayKey())return value.length===10?'Today':'Today · '+timeLabel(value);if(key===tomorrow())return value.length===10?'Tomorrow':'Tomorrow · '+timeLabel(value);return new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,weekday:'short',month:'short',day:'numeric',...(value.length>10?{hour:'numeric',minute:'2-digit'}:{})}).format(d);}
  async function loadEvents(){
    setLoading('events',true);try{const data=await request('/api/events'),now=Date.now(),pref=Number(NOceanStore.settings().dashboard.eventCount),count=[1,3,5,8].includes(pref)?pref:3;state.events=data.events||[];
      const instant=value=>new Date(value.length===10?value+'T12:00:00':value).getTime();
      const future=state.events.filter(e=>e.at&&(e.at.length===10?dateDay(e.at)>=dayKey():instant(e.at)>=now)).sort((a,b)=>instant(a.at)-instant(b.at));
      const important=future.filter(e=>CalendarSemantics.significant(e)).slice(0,3);
      const rows=events=>events.map(e=>`<div class="event-row"><small>${esc(eventWhen(e.at))} · ${esc(CalendarSemantics.classify(e).short||CalendarSemantics.classify(e).label)}</small>${safeURL(e.url)?`<a class="event-name" href="${esc(safeURL(e.url))}" target="_blank" rel="noopener">${esc(e.name)}</a>`:`<span class="event-name">${esc(e.name)}</span>`}</div>`).join('');
      $('eventList').innerHTML=`<section aria-labelledby="eventsNext"><h3 id="eventsNext" class="eyebrow">Next</h3>${rows(future.slice(0,count))||empty('No upcoming events.')}</section><section aria-labelledby="eventsClock"><h3 id="eventsClock" class="eyebrow">On the Clock</h3>${rows(important)||empty('No significant events ahead.')}</section>`;$('calendarSource').textContent=[data.source||'Calendar',...(data.warnings||[])].join(' · ');renderCalendar();
    }catch{$('eventList').innerHTML=empty('Calendar unavailable.');$('calendarSource').textContent='Use Open calendar to check directly.';}finally{setLoading('events',false);}
  }
  function refresh(){applyLayout();loadCore();loadCampus();loadEvents();}
  $('quickAdd').addEventListener('submit',async event=>{event.preventDefault();const name=$('taskName').value.trim(),plan=state.tab==='upcoming'?'automatic':state.tab;if(!name||creating)return;creating=true;taskRevision++;$('addButton').disabled=true;try{const result=await tasks.create({name,project:$('taskProject').value.trim(),difficulty:$('taskDifficulty').value,due:Deadlines.serialize($('taskDue').value,$('taskTime').value),focus:plan==='today',...TaskPlanning.change(plan)});state.tasks.unshift(result.task);$('taskName').value='';$('taskDue').value='';$('taskTime').value='';renderTasks();renderRadar();renderCalendar();notify(`Added to ${{today:'today',tomorrow:'tomorrow',automatic:'automatic planning',later:'backlog'}[plan]}.`);}catch(error){$('taskMessage').textContent=error.message;}finally{creating=false;$('addButton').disabled=false;}});
  document.querySelector('.tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(button){state.tab=button.dataset.tab;renderTasks();}});
  $('taskList').addEventListener('click',event=>{
    const focus=event.target.closest('[data-focus]'),today=event.target.closest('[data-today]'),button=event.target.closest('[data-edit]');
    if(focus){const task=state.tasks.find(t=>t.id===focus.dataset.focus);if(task)updateTask(task.id,{focus:!task.focus});}
    else if(today)updateTask(today.dataset.today,TaskPlanning.change('today'));
    else if(button)openEditor(button.dataset.edit);
  });
  $('taskList').addEventListener('change',event=>{if(event.target.dataset.complete)updateTask(event.target.dataset.complete,{status:event.target.checked?'done':'next'});});
  $('deadlineView').addEventListener('change',renderRadar);
  $('academicRadar').addEventListener('click',async event=>{
    const toggle=event.target.closest('[data-course-toggle]');
    if(toggle){const prefs=NOceanStore.settings().dashboard,key=toggle.dataset.courseToggle;NOceanStore.saveSettings({dashboard:{collapsedCourses:{...prefs.collapsedCourses,[key]:!prefs.collapsedCourses?.[key]}}});renderRadar();$('academicRadar').querySelector(`[data-course-toggle="${key}"]`)?.focus();return;}
    const button=event.target.closest('[data-verify]');if(!button)return;
    const task=state.tasks.find(t=>t.id===button.dataset.verify);if(!task||state.pending.has(task.id))return;
    const previous=NOceanStore.verification(task),next=previous==='pending'?'submitted':'pending';
    if(!NOceanStore.setVerification(task,next)){notify('Submission could not be saved on this device.');return;}
    renderRadar();renderCalendar();
    if(next==='submitted'&&task.status!=='done'&&!await updateTask(task.id,{status:'done'},false)){
      NOceanStore.setVerification(task,previous);renderRadar();renderCalendar();return;
    }
    notify(next==='submitted'?'Marked submitted.':'Submission confirmation undone.',next==='submitted'?()=>{NOceanStore.setVerification(task,'pending');renderRadar();renderCalendar();if(task.status!=='done')updateTask(task.id,{status:task.status},false);}:null);
  });
  $('calendarGrid').addEventListener('click',event=>{const button=event.target.closest('[data-calendar-day]');if(!button)return;state.selectedDay=button.dataset.calendarDay;renderCalendar();});
  $('calendarPrev').addEventListener('click',()=>moveCalendar(-1));$('calendarNext').addEventListener('click',()=>moveCalendar(1));
  document.querySelector('.plan-actions').addEventListener('click',event=>{const button=event.target.closest('[data-plan]');if(!button)return;editingPlan=button.dataset.plan;document.querySelectorAll('#editDialog [data-plan]').forEach(b=>b.classList.toggle('active',b===button));});
  $('editTask').addEventListener('submit',async event=>{event.preventDefault();const id=$('editId').value,radar=$('editRadar').checked,changes={name:$('editName').value.trim(),project:$('editProject').value.trim(),course:$('editCourse').value,difficulty:$('editDifficulty').value,focus:$('editFocus').checked,due:Deadlines.serialize($('editDue').value,$('editTime').value)};if(editingPlan)Object.assign(changes,TaskPlanning.change(editingPlan));$('saveEdit').disabled=true;if(await updateTask(id,changes)){const saved=state.tasks.find(t=>t.id===id);if(saved)NOceanStore.setRadarItem(saved,radar);renderRadar();$('editDialog').close();notify('Task saved.');}$('saveEdit').disabled=false;});
  $('archiveTask').addEventListener('click',async()=>{const id=$('editId').value;try{await tasks.archive(id);state.tasks=state.tasks.filter(t=>t.id!==id);$('editDialog').close();renderTasks();renderRadar();renderCalendar();notify('Task archived.');}catch(error){$('editError').textContent=error.message;}});
  $('closeEdit').onclick=$('cancelEdit').onclick=()=>$('editDialog').close();$('refresh').addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))refresh();});
  window.addEventListener('storage',event=>{if(event.key==='nocean.command.settings.v1'){applyLayout();renderRadar();loadEvents();}});
  refresh();
})();
