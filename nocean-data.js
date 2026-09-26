'use strict';
// Shared HTTP contracts; pages own visible state. Successful list reads are mirrored
// into a short-lived session cache so moving between Home and Projects is immediate.
const NOceanData=(()=>{
 const prefix='nocean.api-cache.v1.';
 function write(name,value){try{sessionStorage.setItem(prefix+name,JSON.stringify({at:Date.now(),value}));}catch{}return value;}
 function peek(name,maxAge=300000){try{const cached=JSON.parse(sessionStorage.getItem(prefix+name)||'null');return cached&&Date.now()-cached.at<=maxAge?cached.value:null;}catch{return null;}}
 const list=(name,url)=>NOcean.request(url).then(value=>write(name,value));
 return {
  cache:{peek},
  tasks:{list:()=>list('tasks','/api/tasks'),create:task=>NOcean.request('/api/tasks',{method:'POST',body:JSON.stringify(task)}),update:task=>NOcean.request('/api/tasks',{method:'PATCH',body:JSON.stringify(task)}),archive:id=>NOcean.request('/api/tasks',{method:'DELETE',body:JSON.stringify({id})})},
  steps:{list:taskId=>NOcean.request('/api/tasks?steps='+encodeURIComponent(taskId)),create:step=>NOcean.request('/api/tasks',{method:'POST',body:JSON.stringify({step:true,...step})}),update:step=>NOcean.request('/api/tasks',{method:'PATCH',body:JSON.stringify({step:true,...step})}),remove:step=>NOcean.request('/api/tasks',{method:'DELETE',body:JSON.stringify({step:true,...step})})},
  projects:{list:()=>list('projects','/api/projects'),create:project=>NOcean.request('/api/projects',{method:'POST',body:JSON.stringify(project)}),update:project=>NOcean.request('/api/projects',{method:'PATCH',body:JSON.stringify(project)})}
 };
})();
