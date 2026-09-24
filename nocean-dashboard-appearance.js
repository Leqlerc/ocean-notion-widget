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
  // Eight hue families, each ordered from soft to deep; semantic colors stay separate.
  const families={
    Red:[["red-soft","#fee2e2"],["red-light","#fecaca"],["coral","#fca5a5"],["red","#f87171"],["ruby","#dc2626"],["wine","#7f1d1d"]],
    Orange:[["orange-soft","#ffedd5"],["peach","#fed7aa"],["orange-light","#fdba74"],["orange","#fb923c"],["copper","#ea580c"],["orange-dark","#9a3412"]],
    Yellow:[["cream","#fef9c3"],["lemon","#fef08a"],["yellow-light","#fde047"],["gold","#facc15"],["yellow","#ca8a04"],["yellow-dark","#854d0e"]],
    Green:[["mint","#dcfce7"],["green","#bbf7d0"],["green-medium","#86efac"],["jade","#4ade80"],["forest","#16a34a"],["green-dark","#166534"]],
    Blue:[["frost","#dbeafe"],["ice","#bfdbfe"],["blue","#93c5fd"],["azure","#60a5fa"],["denim","#2563eb"],["navy","#1e3a8a"]],
    Purple:[["lavender","#f3e8ff"],["lilac","#e9d5ff"],["periwinkle","#d8b4fe"],["iris","#c084fc"],["purple","#9333ea"],["plum","#581c87"]],
    Pink:[["rose","#fce7f3"],["pink-light","#fbcfe8"],["pink","#f9a8d4"],["orchid","#f472b6"],["berry","#db2777"],["pink-dark","#831843"]],
    Chrome:[["white","#ffffff"],["silver","#d1d5db"],["gray","#9ca3af"],["slate","#4b5563"],["eclipse","#27272a"],["black","#09090b"]]
  };
  const accents={};
  for(const [family,shades] of Object.entries(families))shades.forEach(([key,color],index)=>{
    const dark=index>=4||(family==='Chrome'&&index>=3);
    accents[key]={family,shade:index+1,label:family+' · '+(index+1)+' / 6',accent:color,secondary:dark?'#d8e3ed':color,ink:dark?'#ffffff':'#102026',soft:color+'29',hover:color,line:dark?'#94a6b4':color,text:dark?'#d8e3ed':color};
  });
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
    root.style.setProperty('--accent-text',accent.text||accent.accent);
    root.style.setProperty('--accent-2',accent.secondary);
    root.style.setProperty('--ink',accent.ink);
    root.style.setProperty('--accent-soft',accent.soft);
    root.style.setProperty('--accent-hover',accent.hover);
    root.style.setProperty('--accent-line',accent.line);
    document.body.dataset.topBiomeHeight=String(appearance.topBiomeHeight);
    document.body.dataset.cardOpacity=String(appearance.cardOpacity);
    document.body.dataset.accent=appearance.accent;
    document.body.dataset.difficultyColors=appearance.difficultyColors;
    document.body.dataset.calendarWorkload=appearance.calendarWorkload||'solid';
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
  function setCalendarWorkload(value) {
    return save({...current(),calendarWorkload:['off','solid','outline'].includes(value)?value:'solid'});
  }
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('storage',event=>{if(event.key==='nocean.command.settings.v1')apply();});
  return {assets,cards,accents,apply,setTopBiomeHeight,setCardOpacity,setAccent,setDifficultyColors,setCalendarWorkload,setCard,current};
})();
