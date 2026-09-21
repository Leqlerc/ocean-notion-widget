'use strict';
(() => {
  const {$,esc}=NOcean;
  const biomes=[['auto','Rotate with time of day'],['blood-kelp','Blood Kelp Zone'],['bulb-zone','Bulb Zone'],['cove-tree','Cove Tree'],['dunes','Dunes'],['grand-reef','Grand Reef'],['islands','Underwater Islands'],['jelly-caves','Jelly Caves'],['kelp-day','Sunlit Kelp Forest'],['kelp-night','Moonlit Kelp Forest'],['lily-caves','Lily Caves'],['lily-islands','Lily Islands'],['lost-river','Lost River'],['mountains','Abyssal Mountains'],['mushroom-forest','Mushroom Forest'],['shallows-night','Moonlit Shallows'],['sparse-reef','Sparse Reef'],['twisty-bridge-night','Twisty Bridge · Night'],['twisty-bridge','Twisty Bridge']];
  let statusTimer,topHeightTimer,cardOpacityTimer;
  function status(text){$('settingsStatus').textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('settingsStatus').textContent='',4000);}
  function clamp(value,min,max,fallback){const number=Number(value);return Number.isFinite(number)?Math.round(Math.max(min,Math.min(max,number))):fallback;}
  function syncPair(range,number,value){range.value=String(value);number.value=String(value);}
  function commitTopHeight(value){value=clamp(value,80,500,176);syncPair($('topBiomeHeight'),$('topBiomeHeightNumber'),value);NOceanDashboardAppearance.setTopBiomeHeight(value);return value;}
  function commitCardOpacity(value){value=clamp(value,20,100,100);syncPair($('cardOpacity'),$('cardOpacityNumber'),value);NOceanDashboardAppearance.setCardOpacity(value);return value;}
  function saveHomeCopy(){
    const defaults=NOceanStore.defaults.homeCopy,heading=$('homeHeadingSetting').value.trim().slice(0,80)||defaults.heading,subtitle=$('homeSubtitleSetting').value.trim().slice(0,180);
    NOceanStore.saveSettings({homeCopy:{heading,subtitle}});NOceanDashboardAppearance.apply();
  }
  function render(){
    const settings=NOceanStore.settings();
    $('classList').innerHTML=settings.classes.map(name=>`<div class="config-row"><div><strong>${esc(name)}</strong><small>Permanent Academic Radar card</small></div><button class="quiet" data-remove-class="${esc(name)}">Remove</button></div>`).join('')||'<p class="empty">No classes configured.</p>';
    $('maintenanceConfig').innerHTML=settings.maintenance.map(item=>`<div class="config-row"><div><strong>${esc(item.name)}</strong><small>Every ${esc(item.every)} day${item.every===1?'':'s'}</small></div><button class="quiet" data-remove-maintenance="${esc(item.id)}">Remove</button></div>`).join('')||'<p class="empty">No recurring maintenance configured.</p>';
    $('rainThreshold').value=settings.dashboard.rainThreshold;$('eventCount').value=settings.dashboard.eventCount;$('showDining').checked=Boolean(settings.dashboard.showDining);
    syncPair($('topBiomeHeight'),$('topBiomeHeightNumber'),settings.appearance.topBiomeHeight);
    syncPair($('cardOpacity'),$('cardOpacityNumber'),settings.appearance.cardOpacity);
    $('homeHeadingSetting').value=settings.homeCopy.heading;$('homeSubtitleSetting').value=settings.homeCopy.subtitle;
    $('cardArtSettings').innerHTML=Object.entries(NOceanDashboardAppearance.cards).map(([key,label])=>`<label>${esc(label)}<select data-card-art-setting="${esc(key)}">${Object.entries(NOceanDashboardAppearance.assets).map(([image,name])=>`<option value="${esc(image)}" ${settings.appearance.cardArt[key]===image?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`).join('');
  }
  $('biomeChoice').innerHTML=biomes.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  let decorated=true,biome='auto';try{const saved=localStorage.getItem('nocean.decorated');decorated=saved===null?true:saved==='true';biome=localStorage.getItem('nocean.biome.v1')||'auto';}catch{}
  $('biomeAtmosphere').checked=decorated;$('biomeChoice').value=biomes.some(([key])=>key===biome)?biome:'auto';
  $('biomeAtmosphere').addEventListener('change',event=>{NOceanUI.setTheme(event.target.checked);status(event.target.checked?'Biome atmosphere enabled.':'Biome atmosphere disabled.');});
  $('biomeChoice').addEventListener('change',event=>{try{localStorage.setItem('nocean.biome.v1',event.target.value);}catch{}document.dispatchEvent(new Event('nocean:biome'));status('Biome preference saved.');});
  $('topBiomeHeight').addEventListener('input',event=>{const value=commitTopHeight(event.target.value);status(`Top biome height saved at ${value}px.`);});
  $('topBiomeHeightNumber').addEventListener('input',event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>=80&&value<=500){$('topBiomeHeight').value=String(Math.round(value));NOceanDashboardAppearance.setTopBiomeHeight(value);}clearTimeout(topHeightTimer);topHeightTimer=setTimeout(()=>{const saved=commitTopHeight(event.target.value);status(`Top biome height saved at ${saved}px.`);},350);});
  $('topBiomeHeightNumber').addEventListener('change',event=>{clearTimeout(topHeightTimer);const value=commitTopHeight(event.target.value);status(`Top biome height saved at ${value}px.`);});
  $('cardOpacity').addEventListener('input',event=>{const value=commitCardOpacity(event.target.value);status(`Card opacity saved at ${value}%.`);});
  $('cardOpacityNumber').addEventListener('input',event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>=20&&value<=100){$('cardOpacity').value=String(Math.round(value));NOceanDashboardAppearance.setCardOpacity(value);}clearTimeout(cardOpacityTimer);cardOpacityTimer=setTimeout(()=>{const saved=commitCardOpacity(event.target.value);status(`Card opacity saved at ${saved}%.`);},350);});
  $('cardOpacityNumber').addEventListener('change',event=>{clearTimeout(cardOpacityTimer);const value=commitCardOpacity(event.target.value);status(`Card opacity saved at ${value}%.`);});
  $('homeHeadingSetting').addEventListener('input',saveHomeCopy);$('homeSubtitleSetting').addEventListener('input',saveHomeCopy);
  $('resetHomeCopy').addEventListener('click',()=>{NOceanStore.saveSettings({homeCopy:{...NOceanStore.defaults.homeCopy}});render();NOceanDashboardAppearance.apply();status('Home heading and subtitle restored.');});
  $('cardArtSettings').addEventListener('change',event=>{const select=event.target.closest('[data-card-art-setting]');if(!select)return;NOceanDashboardAppearance.setCard(select.dataset.cardArtSetting,select.value);status(select.value==='none'?'Card restored to its default surface.':'Card background saved.');});
  $('dashboardSettings').addEventListener('submit',event=>{event.preventDefault();NOceanStore.saveSettings({dashboard:{showDining:$('showDining').checked,rainThreshold:Number($('rainThreshold').value),eventCount:Number($('eventCount').value)}});render();status('Dashboard preferences saved.');});
  $('classForm').addEventListener('submit',event=>{event.preventDefault();const name=$('className').value.trim().toUpperCase(),settings=NOceanStore.settings();if(name&&!settings.classes.some(x=>x.toUpperCase()===name)){settings.classes.push(name);NOceanStore.saveSettings({classes:settings.classes});}$('className').value='';render();status('Class configuration saved.');});
  $('classList').addEventListener('click',event=>{const button=event.target.closest('[data-remove-class]');if(!button)return;NOceanStore.saveSettings({classes:NOceanStore.settings().classes.filter(x=>x!==button.dataset.removeClass)});render();status('Class removed.');});
  $('maintenanceForm').addEventListener('submit',event=>{event.preventDefault();const settings=NOceanStore.settings(),name=$('maintenanceName').value.trim(),every=Math.max(1,Math.min(365,Number($('maintenanceEvery').value)||7));if(name)settings.maintenance.push({id:crypto.randomUUID(),name,every});NOceanStore.saveSettings({maintenance:settings.maintenance});$('maintenanceName').value='';render();status('Maintenance schedule saved.');});
  $('maintenanceConfig').addEventListener('click',event=>{const button=event.target.closest('[data-remove-maintenance]');if(!button)return;NOceanStore.saveSettings({maintenance:NOceanStore.settings().maintenance.filter(x=>x.id!==button.dataset.removeMaintenance)});render();status('Maintenance item removed.');});
  render();
})();
