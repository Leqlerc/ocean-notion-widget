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
    if(typeof NOceanStore==='undefined')return {topBiomeSize:'compact',cardArt:{}};
    return NOceanStore.settings().appearance;
  }
  function apply() {
    const appearance=current();
    document.body.dataset.biomeSize=appearance.topBiomeSize;
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
  function setBiomeSize(value) {
    const appearance=current();
    return save({...appearance,topBiomeSize:value==='expanded'?'expanded':'compact'});
  }
  function setCard(key,image) {
    if(!Object.hasOwn(cards,key))return false;
    const appearance=current(),safe=Object.hasOwn(assets,image)?image:'none';
    return save({...appearance,cardArt:{...appearance.cardArt,[key]:safe}});
  }
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('storage',event=>{if(event.key==='nocean.command.settings.v1')apply();});
  return {assets,cards,apply,setBiomeSize,setCard,current};
})();
