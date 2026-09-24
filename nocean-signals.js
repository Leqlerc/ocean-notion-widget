'use strict';
const NOceanSignals=(()=>{
  function weather(current={}) {
    const code=Number(current.weather_code);
    if([48,56,57,66,67,71,73,75,77,85,86].includes(code))return 'snow';
    if([51,53,55,61,63,65,80,81,82,95,96,99].includes(code))return 'rain';
    if(Number(current.wind_speed_10m)>=30)return 'wind'; // Open-Meteo defaults to km/h.
    if([2,3,45].includes(code))return 'cloud';
    return [0,1].includes(code)?'clear':'unknown';
  }
  const cutoff='2026-09-24';
  function add(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function progress(days,today) {
    const byDay=new Map();
    for(const d of days)if(d.date>=cutoff&&d.date<=today)byDay.set(d.date,d);
    const complete=[...byDay.values()].filter(d=>d.completed),weekday=new Date(today+'T12:00:00').getDay(),monday=add(today,-((weekday+6)%7));
    const dates=new Set(complete.map(d=>d.date));let streak=0,cursor=dates.has(today)?today:add(today,-1);
    while(dates.has(cursor)){streak++;cursor=add(cursor,-1);}
    return {byDay,week:complete.filter(d=>d.date>=monday).length,month:complete.filter(d=>d.date.slice(0,7)===today.slice(0,7)).length,streak};
  }
  function renderProgress(node,days,today) {
    const p=progress(days,today),start=add(today,-181),cells=[];
    for(let day=start;day<=today;day=add(day,1)){
      const d=p.byDay.get(day),level=d?.completed?Math.min(4,2+Math.floor((d.workingSets||0)/8)):d?.started?1:0;
      const label=`${day}: ${day<cutoff?'before tracking began':d?.completed?'workout completed':d?.started?'in progress':'no workout'}`;
      cells.push(`<span class="activity-cell level-${level}" tabindex="0" title="${label}" aria-label="${label}"></span>`);
    }
    node.innerHTML=`<div class="progress-stats"><span><strong>${p.week}</strong> workouts this week</span><span><strong>${p.month}</strong> this month</span><span><strong>${p.streak}</strong> day streak</span><span><strong>${p.week}/7</strong> weekly consistency</span></div><div class="activity-map" role="group" aria-label="Workout activity, last 26 weeks; oldest first">${cells.join('')}</div><p class="section-note">${start} → ${today} · Dim: none · Light: in progress · Green: completed · Brighter: more sets. Tracking starts September 24, 2026.</p>`;
  }
  return {weather,progress,renderProgress};
})();
