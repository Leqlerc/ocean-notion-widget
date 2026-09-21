'use strict';
// Small device-local records that do not belong in the task, project, or training schemas.
// Every write is additive and independently namespaced so existing provider data is untouched.
const NOceanStore = (() => {
  const SETTINGS_KEY = 'nocean.command.settings.v1';
  const VERIFY_KEY = 'nocean.coursework.verification.v1';
  const MACHINE_KEY = 'nocean.machine.local.v1';
  const defaultClasses = ['MA 261', 'MFET 163', 'CS 159', 'ENGR 161', 'HONR 19901'];
  const defaultMaintenance = [
    {id:'shave',name:'Shave',every:7},
    {id:'sheets',name:'Change sheets',every:7},
    {id:'shopping',name:'Shop essentials',every:7}
  ];
  const defaults = {
    classes: defaultClasses,
    maintenance: defaultMaintenance,
    dashboard: {showDining:true,rainThreshold:35,eventCount:6}
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  function read(key, fallback) {
    try { const value=JSON.parse(localStorage.getItem(key)||'null'); return value && typeof value==='object' ? value : clone(fallback); }
    catch { return clone(fallback); }
  }
  function write(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } }
  function settings() {
    const value=read(SETTINGS_KEY,defaults);
    return {
      classes:Array.isArray(value.classes)?value.classes.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,40)):clone(defaultClasses),
      maintenance:Array.isArray(value.maintenance)?value.maintenance.filter(x=>x&&x.id&&x.name).map(x=>({id:String(x.id),name:String(x.name).slice(0,80),every:Math.max(1,Math.min(365,Number(x.every)||7))})):clone(defaultMaintenance),
      dashboard:{...defaults.dashboard,...(value.dashboard||{})}
    };
  }
  function saveSettings(value) { return write(SETTINGS_KEY,{...settings(),...value}); }
  function verificationId(task) { return task?.sourceId || task?.id || ''; }
  function verification(task) {
    const item=read(VERIFY_KEY,{})[verificationId(task)];
    return ['submitted','verified'].includes(item?.state) ? item.state : 'pending';
  }
  function setVerification(task,state) {
    if (!['pending','submitted','verified'].includes(state) || !verificationId(task)) return false;
    const all=read(VERIFY_KEY,{}),key=verificationId(task);
    if(state==='pending') delete all[key];
    else all[key]={state,name:String(task.name||'').slice(0,500),due:task.due||null,updatedAt:new Date().toISOString()};
    return write(VERIFY_KEY,all);
  }
  function machine() {
    const value=read(MACHINE_KEY,{});
    return {
      nutrition:value.nutrition&&typeof value.nutrition==='object'?value.nutrition:{},
      sleep:value.sleep&&typeof value.sleep==='object'?value.sleep:{},
      maintenance:value.maintenance&&typeof value.maintenance==='object'?value.maintenance:{},
      reflections:Array.isArray(value.reflections)?value.reflections.slice(0,100):[]
    };
  }
  function saveMachine(value) { return write(MACHINE_KEY,value); }
  function updateMachine(mutator) { const value=machine(); mutator(value); saveMachine(value); return value; }
  function saveNutrition(day,entry) { return updateMachine(v=>{v.nutrition[day]={calories:Number(entry.calories)||0,protein:Number(entry.protein)||0,water:Number(entry.water)||0};}); }
  function saveSleep(day,entry) { return updateMachine(v=>{v.sleep[day]={hours:Number(entry.hours)||0,quality:String(entry.quality||'')};}); }
  function completeMaintenance(id,day) { return updateMachine(v=>{if(v.maintenance[id]===day)delete v.maintenance[id];else v.maintenance[id]=day;}); }
  function addReflection(entry) {
    return updateMachine(v=>{v.reflections.unshift({id:crypto.randomUUID(),date:entry.date,type:entry.type,title:String(entry.title||'').trim().slice(0,120),body:String(entry.body||'').trim().slice(0,4000),createdAt:new Date().toISOString()});v.reflections=v.reflections.slice(0,100);});
  }
  function removeReflection(id) { return updateMachine(v=>{v.reflections=v.reflections.filter(x=>x.id!==id);}); }
  function addDays(day,count) { const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+count);return d.toISOString().slice(0,10); }
  function maintenanceStatus(today=new Date().toISOString().slice(0,10)) {
    const data=machine(),config=settings().maintenance;
    return config.map(item=>{const last=data.maintenance[item.id]||'';const due=last?addDays(last,item.every):today;return {...item,last,due,completedToday:last===today,overdue:due<today,isDue:due<=today};});
  }
  return {defaults,settings,saveSettings,verification,setVerification,machine,saveNutrition,saveSleep,completeMaintenance,addReflection,removeReflection,maintenanceStatus};
})();
