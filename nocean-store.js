'use strict';
// Small device-local records that do not belong in the task, project, or training schemas.
// Every write is additive and independently namespaced so existing provider data is untouched.
const NOceanStore = (() => {
  const SETTINGS_KEY = 'nocean.command.settings.v1';
  const VERIFY_KEY = 'nocean.coursework.verification.v1';
  const RADAR_KEY = 'nocean.coursework.radar.v1';
  const MACHINE_KEY = 'nocean.machine.local.v1';
  const defaultClasses = ['MA 261', 'MFET 163', 'CS 159', 'ENGR 161', 'HONR 19901'];
  const defaultMaintenance = [
    {id:'shave',name:'Shave',every:7},
    {id:'sheets',name:'Change sheets',every:7},
    {id:'shopping',name:'Shop essentials',every:7}
  ];
  const accentPresets = new Set(['ice','mint','lavender','rose','cream','white','blue','green','lilac','pink','peach','gray','denim','teal','purple','berry','sand','eclipse','navy','forest','plum','wine','copper','black']);
  const difficultyModes = new Set(['off','solid','glow']);
  const cardArtKeys = ['tasks','deadlines','events','campus','calendar'];
  const biomeAssets = new Set(['blood-kelp','bulb-zone','cove-tree','dunes','grand-reef','islands','jelly-caves','kelp-day','kelp-night','lily-caves','lily-islands','lost-river','mountains','mushroom-forest','shallows-night','sparse-reef','twisty-bridge-night','twisty-bridge']);
  const defaults = {
    classes: defaultClasses,
    maintenance: defaultMaintenance,
    dashboard: {showTasks:true,showDeadlines:true,showEvents:true,showCampus:true,showCalendar:true,showWeather:true,showFacilities:true,showDining:true,rainThreshold:35,eventCount:3,deadlineCount:'3',taskSort:'plan',collapsedCourses:{}},
    appearance: {topBiomeHeight:176,cardOpacity:100,accent:'green',difficultyColors:'off',calendarWorkload:'solid',cardArt:{}}
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value,min,max,fallback) => {
    const number=Number(value);
    return Number.isFinite(number)?Math.round(Math.max(min,Math.min(max,number))):fallback;
  };
  const copyText = (value,fallback,limit,allowEmpty=false) => {
    if(typeof value!=='string')return fallback;
    const text=value.trim().slice(0,limit);
    return text|| (allowEmpty?'':fallback);
  };
  function read(key, fallback) {
    try { const value=JSON.parse(localStorage.getItem(key)||'null'); return value && typeof value==='object' ? value : clone(fallback); }
    catch { return clone(fallback); }
  }
  function write(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } }
  function settings() {
    const value=read(SETTINGS_KEY,defaults);
    const rawAppearance=value.appearance&&typeof value.appearance==='object'?value.appearance:{};
    const rawCardArt=rawAppearance.cardArt&&typeof rawAppearance.cardArt==='object'?rawAppearance.cardArt:{};
    const cardArt=Object.fromEntries(cardArtKeys.map(key=>[key,biomeAssets.has(rawCardArt[key])?rawCardArt[key]:'none']));
    const legacyHeight=rawAppearance.topBiomeSize==='expanded'?258:defaults.appearance.topBiomeHeight;
    return {
      classes:Array.isArray(value.classes)?value.classes.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,40)):clone(defaultClasses),
      maintenance:Array.isArray(value.maintenance)?value.maintenance.filter(x=>x&&x.id&&x.name).map(x=>({id:String(x.id),name:String(x.name).slice(0,80),every:Math.max(1,Math.min(365,Number(x.every)||7))})):clone(defaultMaintenance),
      dashboard:{...defaults.dashboard,...(value.dashboard||{})},
      appearance:{
        topBiomeHeight:clamp(rawAppearance.topBiomeHeight,80,500,legacyHeight),
        cardOpacity:clamp(rawAppearance.cardOpacity,20,100,defaults.appearance.cardOpacity),
        accent:accentPresets.has(rawAppearance.accent)?rawAppearance.accent:defaults.appearance.accent,
        difficultyColors:difficultyModes.has(rawAppearance.difficultyColors)?rawAppearance.difficultyColors:defaults.appearance.difficultyColors,
        calendarWorkload:['off','solid','outline'].includes(rawAppearance.calendarWorkload)?rawAppearance.calendarWorkload:defaults.appearance.calendarWorkload,
        cardArt
      }
    };
  }
  function saveSettings(value) { const current=settings();return write(SETTINGS_KEY,{...current,...value,dashboard:{...current.dashboard,...(value.dashboard||{})}}); }
  function verificationId(task) { return task?.sourceId || task?.id || ''; }
  function isRadarItem(task) {
    return String(task?.sourceId||'').startsWith('brightspace:');
  }
  function setRadarItem(task,tracked) {
    return false;
  }
  function verification(task) {
    const item=read(VERIFY_KEY,{})[verificationId(task)];
    return ['submitted','verified'].includes(item?.state) ? 'submitted' : 'pending';
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
  return {defaults,settings,saveSettings,isRadarItem,setRadarItem,verification,setVerification,machine,saveNutrition,saveSleep,completeMaintenance,addReflection,removeReflection,maintenanceStatus};
})();
