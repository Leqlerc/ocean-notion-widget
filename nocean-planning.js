
'use strict';
// One planning policy shared by Home and Tasks. Deadlines are never moved by planning.
const TaskPlanning=(()=>{
 const day=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 const add=(base,days)=>{const d=new Date(base+'T12:00:00');d.setDate(d.getDate()+days);return day(d);};
 const dateKey=value=>!value?null:value.length===10?value:day(new Date(value));
 function bucket(task,today=day()){
  if(task.planningMode==='backlog')return 'later';
  const planned=dateKey(task.scheduledFor),due=dateKey(task.due);
  if(planned)return planned<=today?'today':planned===add(today,1)?'tomorrow':planned<=add(today,14)?'upcoming':'later';
  if(task.focus||task.status==='doing'||(due&&due<=today))return 'today';
  if(due===add(today,1))return 'tomorrow';
  return due&&due<=add(today,14)?'upcoming':'later';
 }
 function matches(task,view,today=day()){return view==='all'||bucket(task,today)===view;}
 function change(destination,today=day()){
  if(destination==='today'||destination==='tomorrow')return {planningMode:'planned',scheduledFor:add(today,destination==='tomorrow'?1:0),focus:false};
  if(destination==='later')return {planningMode:'backlog',scheduledFor:null,focus:false};
  if(destination==='automatic')return {planningMode:'automatic',scheduledFor:null};
  throw new Error('Unknown planning destination.');
 }
 function label(task,today=day()){
  if(task.planningMode==='backlog')return 'Backlog';
  const planned=dateKey(task.scheduledFor);if(!planned)return '';
  return planned<today?'Rolled over · '+planned:planned===today?'Planned today':planned===add(today,1)?'Planned tomorrow':'Planned '+planned;
 }
 return {day,add,dateKey,bucket,matches,change,label};
})();
