'use strict';
const TaskFilters=(()=>{
  const difficulties=['Unrated','Easy','Medium','Hard'];
  const dueOptions={all:'Any due date',overdue:'Overdue',today:'Today',tomorrow:'Tomorrow',week:'This week',later:'Later',none:'No due date'};
  function dueMatch(value,filter='all',now=new Date()) {
    if(filter==='all')return true;
    if(!value)return filter==='none';
    const day=Deadlines.fields(value).date,today=Deadlines.fields(now.toISOString()).date;
    const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);
    const end=new Date(now);end.setDate(now.getDate()+(7-now.getDay())%7);
    const start=new Date(end);start.setDate(end.getDate()-6);
    const key=d=>Deadlines.fields(d.toISOString()).date;
    return {overdue:day<today,today:day===today,tomorrow:day===key(tomorrow),week:day>=key(start)&&day<=key(end),later:day>key(end),none:false}[filter]||false;
  }
  function belongs(task,project){return (task.projectIds||[]).includes(project.id)||(!(task.projectIds||[]).length&&task.project===project.name);}
  function matches(task,filters={},projects=[],now=new Date()) {
    if(!dueMatch(task.due,filters.due,now))return false;
    if(filters.difficulty && filters.difficulty!=='all' && (task.difficulty||'Unrated')!==filters.difficulty)return false;
    if(filters.project==='none')return !(task.projectIds||[]).length&&!task.project;
    if(filters.project&&filters.project!=='all'){const project=projects.find(p=>p.id===filters.project);return !!project&&belongs(task,project);}
    return true;
  }
  return {difficulties,dueOptions,dueMatch,matches,belongs};
})();
