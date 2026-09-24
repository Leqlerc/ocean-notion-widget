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
  // Rows progress from pastel to dark; each column stays in one hue family.
  const accents = {
    ice:{"label":"Ice blue","accent":"#8fd3ff","secondary":"#8fd3ff","ink":"#102026","soft":"rgba(143,211,255,.16)","hover":"#8fd3ff","line":"rgba(143,211,255,.65)","text":"#8fd3ff"},
    mint:{"label":"Mint","accent":"#c4ecd8","secondary":"#c4ecd8","ink":"#102026","soft":"rgba(196,236,216,.16)","hover":"#c4ecd8","line":"rgba(196,236,216,.65)","text":"#c4ecd8"},
    lavender:{"label":"Lavender","accent":"#c7adff","secondary":"#c7adff","ink":"#102026","soft":"rgba(199,173,255,.16)","hover":"#c7adff","line":"rgba(199,173,255,.65)","text":"#c7adff"},
    rose:{"label":"Rosewater","accent":"#f7c4d8","secondary":"#f7c4d8","ink":"#102026","soft":"rgba(247,196,216,.16)","hover":"#f7c4d8","line":"rgba(247,196,216,.65)","text":"#f7c4d8"},
    cream:{"label":"Cream","accent":"#f4e7be","secondary":"#f4e7be","ink":"#102026","soft":"rgba(244,231,190,.16)","hover":"#f4e7be","line":"rgba(244,231,190,.65)","text":"#f4e7be"},
    white:{"label":"White","accent":"#ffffff","secondary":"#ffffff","ink":"#102026","soft":"rgba(255,255,255,.16)","hover":"#ffffff","line":"rgba(255,255,255,.65)","text":"#ffffff"},
    blue:{"label":"Sky blue","accent":"#74b8ed","secondary":"#74b8ed","ink":"#102026","soft":"rgba(116,184,237,.16)","hover":"#74b8ed","line":"rgba(116,184,237,.65)","text":"#74b8ed"},
    green:{"label":"Current light green","accent":"#9fe1cb","secondary":"#9fe1cb","ink":"#102026","soft":"rgba(159,225,203,.16)","hover":"#9fe1cb","line":"rgba(159,225,203,.65)","text":"#9fe1cb"},
    lilac:{"label":"Lilac","accent":"#b59ce7","secondary":"#b59ce7","ink":"#102026","soft":"rgba(181,156,231,.16)","hover":"#b59ce7","line":"rgba(181,156,231,.65)","text":"#b59ce7"},
    pink:{"label":"Soft pink","accent":"#e9a2c5","secondary":"#e9a2c5","ink":"#102026","soft":"rgba(233,162,197,.16)","hover":"#e9a2c5","line":"rgba(233,162,197,.65)","text":"#e9a2c5"},
    peach:{"label":"Peach","accent":"#f5bea0","secondary":"#f5bea0","ink":"#102026","soft":"rgba(245,190,160,.16)","hover":"#f5bea0","line":"rgba(245,190,160,.65)","text":"#f5bea0"},
    gray:{"label":"Gray","accent":"#a4afb8","secondary":"#a4afb8","ink":"#102026","soft":"rgba(164,175,184,.16)","hover":"#a4afb8","line":"rgba(164,175,184,.65)","text":"#a4afb8"},
    denim:{"label":"Denim","accent":"#477aab","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(71,122,171,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    teal:{"label":"Teal","accent":"#63b8ae","secondary":"#63b8ae","ink":"#102026","soft":"rgba(99,184,174,.16)","hover":"#63b8ae","line":"rgba(99,184,174,.65)","text":"#63b8ae"},
    purple:{"label":"Violet","accent":"#8965bb","secondary":"#8965bb","ink":"#102026","soft":"rgba(137,101,187,.16)","hover":"#8965bb","line":"rgba(137,101,187,.65)","text":"#8965bb"},
    berry:{"label":"Berry","accent":"#bb6f9c","secondary":"#bb6f9c","ink":"#102026","soft":"rgba(187,111,156,.16)","hover":"#bb6f9c","line":"rgba(187,111,156,.65)","text":"#bb6f9c"},
    sand:{"label":"Sand","accent":"#c8b38c","secondary":"#c8b38c","ink":"#102026","soft":"rgba(200,179,140,.16)","hover":"#c8b38c","line":"rgba(200,179,140,.65)","text":"#c8b38c"},
    eclipse:{"label":"Eclipse black","accent":"#252734","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(37,39,52,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    navy:{"label":"Navy","accent":"#213f60","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(33,63,96,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    forest:{"label":"Forest","accent":"#2c6559","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(44,101,89,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    plum:{"label":"Plum","accent":"#59416e","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(89,65,110,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    wine:{"label":"Wine","accent":"#713e58","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(113,62,88,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    copper:{"label":"Copper","accent":"#a06d50","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(160,109,80,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"},
    black:{"label":"True black","accent":"#000000","secondary":"#c9d5de","ink":"#ffffff","soft":"rgba(0,0,0,.16)","hover":"#53616f","line":"#94a6b4","text":"#d8e3ed"}
  };
  Object.assign(accents,{"frost":{"label":"Frost","accent":"#d6f5ff","secondary":"#d6f5ff","ink":"#102026","soft":"#d6f5ff29","hover":"#d6f5ff","line":"#d6f5ff","text":"#d6f5ff"},"pistachio":{"label":"Pistachio","accent":"#dce9ac","secondary":"#dce9ac","ink":"#102026","soft":"#dce9ac29","hover":"#dce9ac","line":"#dce9ac","text":"#dce9ac"},"periwinkle":{"label":"Periwinkle","accent":"#9fa8ff","secondary":"#9fa8ff","ink":"#102026","soft":"#9fa8ff29","hover":"#9fa8ff","line":"#9fa8ff","text":"#9fa8ff"},"blush":{"label":"Blush","accent":"#ffcfc1","secondary":"#ffcfc1","ink":"#102026","soft":"#ffcfc129","hover":"#ffcfc1","line":"#ffcfc1","text":"#ffcfc1"},"lemon":{"label":"Lemon","accent":"#fff18a","secondary":"#fff18a","ink":"#102026","soft":"#fff18a29","hover":"#fff18a","line":"#fff18a","text":"#fff18a"},"silver":{"label":"Silver","accent":"#c4cbd5","secondary":"#c4cbd5","ink":"#102026","soft":"#c4cbd529","hover":"#c4cbd5","line":"#c4cbd5","text":"#c4cbd5"},"cyan":{"label":"Cyan","accent":"#35d8e6","secondary":"#35d8e6","ink":"#102026","soft":"#35d8e629","hover":"#35d8e6","line":"#35d8e6","text":"#35d8e6"},"lime":{"label":"Lime","accent":"#abd851","secondary":"#abd851","ink":"#102026","soft":"#abd85129","hover":"#abd851","line":"#abd851","text":"#abd851"},"iris":{"label":"Iris","accent":"#7667e8","secondary":"#7667e8","ink":"#102026","soft":"#7667e829","hover":"#7667e8","line":"#7667e8","text":"#7667e8"},"coral":{"label":"Coral","accent":"#fa8175","secondary":"#fa8175","ink":"#102026","soft":"#fa817529","hover":"#fa8175","line":"#fa8175","text":"#fa8175"},"gold":{"label":"Gold","accent":"#eac14b","secondary":"#eac14b","ink":"#102026","soft":"#eac14b29","hover":"#eac14b","line":"#eac14b","text":"#eac14b"},"slate":{"label":"Slate","accent":"#687d91","secondary":"#687d91","ink":"#102026","soft":"#687d9129","hover":"#687d91","line":"#687d91","text":"#687d91"},"azure":{"label":"Azure","accent":"#228fe0","secondary":"#d8e3ed","ink":"#ffffff","soft":"#228fe029","hover":"#228fe0","line":"#94a6b4","text":"#d8e3ed"},"jade":{"label":"Jade","accent":"#26a883","secondary":"#d8e3ed","ink":"#ffffff","soft":"#26a88329","hover":"#26a883","line":"#94a6b4","text":"#d8e3ed"},"orchid":{"label":"Orchid","accent":"#d070d7","secondary":"#d8e3ed","ink":"#ffffff","soft":"#d070d729","hover":"#d070d7","line":"#94a6b4","text":"#d8e3ed"},"ruby":{"label":"Ruby","accent":"#db4267","secondary":"#d8e3ed","ink":"#ffffff","soft":"#db426729","hover":"#db4267","line":"#94a6b4","text":"#d8e3ed"},"orange":{"label":"Orange","accent":"#f0993e","secondary":"#d8e3ed","ink":"#ffffff","soft":"#f0993e29","hover":"#f0993e","line":"#94a6b4","text":"#d8e3ed"},"taupe":{"label":"Taupe","accent":"#99887e","secondary":"#d8e3ed","ink":"#ffffff","soft":"#99887e29","hover":"#99887e","line":"#94a6b4","text":"#d8e3ed"},"ocean":{"label":"Ocean","accent":"#14576c","secondary":"#d8e3ed","ink":"#ffffff","soft":"#14576c29","hover":"#14576c","line":"#94a6b4","text":"#d8e3ed"},"olive":{"label":"Olive","accent":"#687329","secondary":"#d8e3ed","ink":"#ffffff","soft":"#68732929","hover":"#687329","line":"#94a6b4","text":"#d8e3ed"},"amethyst":{"label":"Amethyst","accent":"#76398d","secondary":"#d8e3ed","ink":"#ffffff","soft":"#76398d29","hover":"#76398d","line":"#94a6b4","text":"#d8e3ed"},"brick":{"label":"Brick","accent":"#a04439","secondary":"#d8e3ed","ink":"#ffffff","soft":"#a0443929","hover":"#a04439","line":"#94a6b4","text":"#d8e3ed"},"ochre":{"label":"Ochre","accent":"#996b14","secondary":"#d8e3ed","ink":"#ffffff","soft":"#996b1429","hover":"#996b14","line":"#94a6b4","text":"#d8e3ed"},"charcoal":{"label":"Charcoal","accent":"#3d4549","secondary":"#d8e3ed","ink":"#ffffff","soft":"#3d454929","hover":"#3d4549","line":"#94a6b4","text":"#d8e3ed"}});
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
