'use strict';
// Shared records; task completion is not a measure of goal attainment.
const ProjectModel = (() => {
 function summarize(project,tasks,now=new Date()) {
  const related=tasks.filter(t=>TaskFilters.belongs(t,project));
  const open=related.filter(t=>t.status!=='done');
  const today=TaskPlanning.day(now);
  const next=[...open].sort((a,b)=>{
   const rank=t=>({today:0,tomorrow:1,upcoming:2,later:3}[TaskPlanning.bucket(t,today)]??4);
   return rank(a)-rank(b)||(a.scheduledFor||a.due||'9999').localeCompare(b.scheduledFor||b.due||'9999')||a.name.localeCompare(b.name);
  });
  return {related,open,next,done:related.length-open.length,
   percent:related.length?Math.round(100*(related.length-open.length)/related.length):null,
   today:open.filter(t=>TaskPlanning.bucket(t,today)==='today').length,
   tomorrow:open.filter(t=>TaskPlanning.bucket(t,today)==='tomorrow').length,
   overdue:open.filter(t=>TaskPlanning.dateKey(t.due)&&TaskPlanning.dateKey(t.due)<today).length};
 }
 function taskURL(projectId,taskId=null){const params=new URLSearchParams({project:projectId,view:'all'});if(taskId)params.set('task',taskId);return '/tasks.html?'+params;}
 return {summarize,taskURL};
})();
