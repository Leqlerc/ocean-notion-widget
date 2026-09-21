'use strict';
// Presentation-only preferences for the shared biome shell and major Home cards.
const NOceanDashboardAppearance = (() => {
  const cards = {
    tasks:'Tasks',
    deadlines:'Academic Radar / Deadlines',
    events:'Events',
    campus:'Campus',
    calendar:'Calendar / Temporal Context'
  };
  const assets = {
    none:'None / default card',
    'blood-kelp':'Blood Kelp Zone',
    'bulb-zone':'Bulb Zone',
    'cove-tree':'Cove Tree',
    dunes:'Dunes',
    'grand-reef':'Grand Reef',
    islands:'Underwater Islands',
    'jelly-caves':'Jelly Caves',
    'kelp-day':'Sunlit Kelp Forest',
    'kelp-night':'Moonlit Kelp Forest',
    'lily-caves':'Lily Caves',
    'lily-islands':'Lily Islands',
    'lost-river':'Lost River',
    mountains:'Abyssal Mountains',
    'mushroom-forest':'Mushroom Forest',
    'shallows-night':'Moonlit Shallows',
    'sparse-reef':'Sparse Reef',
    'twisty-bridge-night':'Twisty Bridge · Night',
    'twisty-bridge':'Twisty Bridge'
  };
  function current() {
    if(typeof NOceanStore==='undefined')return {topBiomeHeight:176,cardOpacity:100,cardArt:{}};
    return NOceanStore.settings().appearance;
  }
  function rgba(rgb,alpha){return `rgba(${rgb},${Math.max(0,Math.min(1,alpha)).toFixed(3)})`;}
  function apply() {
    const appearance=current();
    const root=document.documentElement,opacity=appearance.cardOpacity/100;
    root.style.setProperty('--top-biome-height',`${appearance.topBiomeHeight}px`);
    root.style.setProperty('--card-surface-strong',rgba('17,37,44',.84*opacity));
    root.style.setProperty('--card-surface-soft',rgba('7,18,24',.76*opacity));
    root.style.setProperty('--card-surface-border',rgba('165,214,213',.08+.10*opacity));
    root.style.setProperty('--card-art-overlay-top',rgba('5,18,24',.36+.26*opacity));
    root.style.setProperty('--card-art-overlay-bottom',rgba('4,13,19',.48+.30*opacity));
    root.style.setProperty('--card-art-inner',rgba('3,13,19',.42+.16*opacity));
    document.body.dataset.topBiomeHeight=String(appearance.topBiomeHeight);
    document.body.dataset.cardOpacity=String(appearance.cardOpacity);
    document.querySelectorAll('[data-card-art]').forEach(card=>{
      const key=card.dataset.cardArt,image=Object.hasOwn(assets,appearance.cardArt[key])?appearance.cardArt[key]:'none';
      if(image==='none'){
        card.classList.remove('has-card-art');
        card.style.removeProperty('--card-art-image');
        delete card.dataset.cardArtImage;
        return;
      }
      card.classList.add('has-card-art');
      card.dataset.cardArtImage=image;
      card.style.setProperty('--card-art-image',`url("/assets/backgrounds/${image}.png")`);
    });
    if(typeof NOceanStore!=='undefined'){
      const copy=NOceanStore.settings().homeCopy,heading=document.getElementById('homeHeading'),subtitle=document.getElementById('homeSubtitle');
      if(heading)heading.textContent=copy.heading;
      if(subtitle)subtitle.textContent=copy.subtitle;
    }
  }
  function save(next) {
    if(typeof NOceanStore==='undefined')return false;
    const saved=NOceanStore.saveSettings({appearance:next});
    apply();
    document.dispatchEvent(new CustomEvent('nocean:dashboard-appearance',{detail:current()}));
    return saved;
  }
  function setTopBiomeHeight(value) {
    const appearance=current();
    return save({...appearance,topBiomeHeight:Math.round(Math.max(80,Math.min(500,Number(value)||176)))});
  }
  function setCardOpacity(value) {
    const appearance=current();
    return save({...appearance,cardOpacity:Math.round(Math.max(20,Math.min(100,Number(value)||100)))});
  }
  function setCard(key,image) {
    if(!Object.hasOwn(cards,key))return false;
    const appearance=current(),safe=Object.hasOwn(assets,image)?image:'none';
    return save({...appearance,cardArt:{...appearance.cardArt,[key]:safe}});
  }
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('storage',event=>{if(event.key==='nocean.command.settings.v1')apply();});
  return {assets,cards,apply,setTopBiomeHeight,setCardOpacity,setCard,current};
})();
