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
  const accents = {
    green:{label:'Current light green',accent:'#9fe1cb',secondary:'#7fc8e4',ink:'#06231c',soft:'rgba(159,225,203,.14)',hover:'#b4ead8',line:'rgba(159,225,203,.58)'},
    ice:{label:'Ice blue',accent:'#8fd3ff',secondary:'#b9e7ff',ink:'#061c29',soft:'rgba(143,211,255,.14)',hover:'#b8e5ff',line:'rgba(143,211,255,.58)'},
    lavender:{label:'Lavender',accent:'#c7adff',secondary:'#aebfff',ink:'#24143d',soft:'rgba(199,173,255,.14)',hover:'#dacaff',line:'rgba(199,173,255,.58)'},
    eclipse:{label:'Eclipse',accent:'#f0bc69',secondary:'#d6d0ff',ink:'#261906',soft:'rgba(240,188,105,.14)',hover:'#f6d49a',line:'rgba(240,188,105,.58)'}
  };
  function current() {
    if(typeof NOceanStore==='undefined')return {topBiomeHeight:176,cardOpacity:100,accent:'green',difficultyColors:'off',cardArt:{}};
    return NOceanStore.settings().appearance;
  }
  function rgba(rgb,alpha){return `rgba(${rgb},${Math.max(0,Math.min(1,alpha)).toFixed(3)})`;}
  function apply() {
    const appearance=current();
    const root=document.documentElement,opacity=appearance.cardOpacity/100;
    const accent=accents[appearance.accent]||accents.green;
    root.style.setProperty('--top-biome-height',`${appearance.topBiomeHeight}px`);
    root.style.setProperty('--card-surface-strong',rgba('17,37,44',.84*opacity));
    root.style.setProperty('--card-surface-soft',rgba('7,18,24',.76*opacity));
    root.style.setProperty('--card-surface-border',rgba('165,214,213',.08+.10*opacity));
    root.style.setProperty('--card-art-overlay-top',rgba('5,18,24',.46+.16*opacity));
    root.style.setProperty('--card-art-overlay-bottom',rgba('4,13,19',.58+.20*opacity));
    root.style.setProperty('--card-art-inner',rgba('3,13,19',.42+.16*opacity));
    root.style.setProperty('--accent',accent.accent);
    root.style.setProperty('--accent-2',accent.secondary);
    root.style.setProperty('--ink',accent.ink);
    root.style.setProperty('--accent-soft',accent.soft);
    root.style.setProperty('--accent-hover',accent.hover);
    root.style.setProperty('--accent-line',accent.line);
    document.body.dataset.topBiomeHeight=String(appearance.topBiomeHeight);
    document.body.dataset.cardOpacity=String(appearance.cardOpacity);
    document.body.dataset.accent=appearance.accent;
    document.body.dataset.difficultyColors=appearance.difficultyColors;
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
  function setAccent(value) {
    const appearance=current();
    return save({...appearance,accent:Object.hasOwn(accents,value)?value:'green'});
  }
  function setDifficultyColors(value) {
    const appearance=current(),safe=['off','solid','glow'].includes(value)?value:'off';
    return save({...appearance,difficultyColors:safe});
  }
  function setCard(key,image) {
    if(!Object.hasOwn(cards,key))return false;
    const appearance=current(),safe=Object.hasOwn(assets,image)?image:'none';
    return save({...appearance,cardArt:{...appearance.cardArt,[key]:safe}});
  }
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('storage',event=>{if(event.key==='nocean.command.settings.v1')apply();});
  return {assets,cards,accents,apply,setTopBiomeHeight,setCardOpacity,setAccent,setDifficultyColors,setCard,current};
})();
