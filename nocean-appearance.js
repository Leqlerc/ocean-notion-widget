'use strict';
// Local presentation only: this module never calls a data provider or writes to Notion.
const NOceanAppearance=(()=>{
  const KEY='nocean.appearance.v1';
  const assets={'none':'None / solid','safe-shallows':'Safe Shallows','kelp-forest':'Kelp Forest','grassy-plateaus':'Grassy Plateaus',jellyshroom:'Jelly Shroom','grand-reef':'Grand Reef','blood-kelp':'Blood Kelp','bulb-zone':'Bulb Zone','lost-river':'Lost River','tree-cove':'Tree Cove','dragonair-ocean':'Dragonair Ocean','lilypad-caves':'Lilypad Caves'};
  const tints={Ocean:['7,18,24','#abd7e6'],Deep:['16,12,34','#c4bee9'],Reef:['6,30,23','#b0dfbf'],Neutral:['19,22,24','#d6dce0']};
  const visibility={Subtle:.68,Medium:.46,Strong:.28};
  let settings={},active=null,dialog;
  function validate(value,fallback='none') {
    const v=value&&typeof value==='object'?value:{};
    return {image:Object.hasOwn(assets,v.image)?v.image:fallback,visibility:Object.hasOwn(visibility,v.visibility)?v.visibility:'Medium',tint:Object.hasOwn(tints,v.tint)?v.tint:'Ocean',icon:typeof NOceanIcons!=='undefined'&&NOceanIcons.valid(v.icon)?v.icon:'',rotatingMessages:v.rotatingMessages!==false,message:typeof v.message==='string'?v.message.slice(0,180):''};
  }
  function read(){try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');settings=data.cards&&typeof data.cards==='object'&&!Array.isArray(data.cards)?data.cards:{};}catch{settings={};}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({cards:settings}));return true;}catch{return false;}}
  function paint(el,value){
    const v=validate(value),[rgb,accent]=tints[v.tint],alpha=visibility[v.visibility];
    el.style.background=v.image==='none'?`rgb(${rgb})`:`linear-gradient(145deg,rgba(${rgb},${alpha}),rgba(${rgb},${Math.min(.78,alpha+.15)})),url('/assets/backgrounds/${v.image}.webp') center/cover`;
    el.style.setProperty('--accent',accent);el.dataset.appearanceApplied='true';
  }
  function apply(){
    const enabled=document.body.dataset.preset==='card-art';
    for(const el of document.querySelectorAll('[data-cosmetic]')){
      const id=el.dataset.cosmetic;
      let button=el.querySelector('[data-cosmetic-open]');
      if(!button){button=document.createElement('button');button.type='button';button.className='quiet cosmetic-gear';button.dataset.cosmeticOpen=id;button.textContent='⚙';button.setAttribute('aria-label','Appearance of '+(el.querySelector('h2,h3')?.textContent||id));(el.querySelector('.card-head,.project-heading')||el).append(button);}
      button.hidden=false;
      if(enabled||el.dataset.cosmeticAlways==='true')paint(el,validate(settings[id],el.dataset.defaultArt||'none'));
      else if(el.dataset.appearanceApplied){el.style.removeProperty('background');el.style.removeProperty('--accent');delete el.dataset.appearanceApplied;}
    }
    if(typeof NOceanIcons!=='undefined')NOceanIcons.apply(preference);
    document.dispatchEvent(new Event('nocean:appearance'));
  }
  function preference(id){return validate(settings[id]);}
  function values(){return {...(settings[active]||{}),icon:document.getElementById('projectIcon').value,rotatingMessages:document.getElementById('rotatingMessages').checked,message:document.getElementById('welcomeMessage').value,image:document.getElementById('artImage').value,visibility:document.getElementById('artVisibility').value,tint:document.getElementById('artTint').value};}
  function preview(){paint(document.getElementById('artPreview'),values());document.getElementById('artPreviewName').textContent=assets[values().image];}
  function open(id){
    const target=[...document.querySelectorAll('[data-cosmetic]')].find(el=>el.dataset.cosmetic===id);if(!target)return;
    active=id;document.getElementById('projectIconSettings').hidden=!id.startsWith('project:');document.getElementById('welcomeSettings').hidden=id!=='welcome';const value=validate(settings[id],target.dataset.defaultArt||'none');
    document.getElementById('appearanceTitle').textContent='Appearance · '+(target.querySelector('h2,h3')?.textContent||'Card');
    document.getElementById('artImage').value=value.image;document.getElementById('artVisibility').value=value.visibility;document.getElementById('artTint').value=value.tint;
    document.getElementById('projectIcon').value=value.icon;document.getElementById('rotatingMessages').checked=value.rotatingMessages;document.getElementById('welcomeMessage').value=value.message;document.getElementById('welcomeMessage').disabled=value.rotatingMessages;
    document.getElementById('artStatus').textContent='';preview();dialog.showModal();
  }
  function setup(){
    read();dialog=document.createElement('dialog');dialog.id='appearanceDialog';dialog.setAttribute('aria-labelledby','appearanceTitle');
    dialog.innerHTML=`<form id="appearanceForm"><div class="card-head"><h2 id="appearanceTitle">Appearance</h2><button type="button" class="quiet" id="closeAppearance" aria-label="Close appearance">✕</button></div><div id="artPreview" class="art-preview"><strong id="artPreviewName"></strong></div><label>Background image<select id="artImage">${Object.entries(assets).map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select></label><div class="form-pair"><label>Art visibility<select id="artVisibility"><option>Subtle</option><option>Medium</option><option>Strong</option></select></label><label>Color treatment<select id="artTint">${Object.keys(tints).map(name=>`<option>${name}</option>`).join('')}</select></label></div><label id="projectIconSettings" hidden>Icon<select id="projectIcon"><option value="">Automatic</option>${typeof NOceanIcons!=='undefined'?Object.entries(NOceanIcons.labels).map(([key,label])=>`<option value="${key}">${label}</option>`).join(''):''}</select></label><fieldset id="welcomeSettings" hidden><legend>Welcome message</legend><label class="message-toggle"><input id="rotatingMessages" type="checkbox" checked> Use rotating messages</label><label>Custom message<input id="welcomeMessage" maxlength="180" placeholder="Your own short reminder"></label></fieldset><p class="section-note">Saved for this card on this browser. Cards use these choices in Card Art. The welcome banner uses them in every preset.</p><p id="artStatus" role="status"></p><div class="dialog-actions"><button type="button" id="resetAppearance" class="quiet">Reset card</button><button type="submit" class="primary">Save appearance</button></div></form>`;
    document.body.append(dialog);
    document.getElementById('rotatingMessages').addEventListener('change',e=>{document.getElementById('welcomeMessage').disabled=e.target.checked;});
    document.addEventListener('click',e=>{const button=e.target.closest('[data-cosmetic-open]');if(button)open(button.dataset.cosmeticOpen);});
    document.getElementById('closeAppearance').addEventListener('click',()=>dialog.close());
    for(const id of ['artImage','artVisibility','artTint'])document.getElementById(id).addEventListener('change',preview);
    document.getElementById('appearanceForm').addEventListener('submit',e=>{e.preventDefault();settings[active]=values();const saved=save();apply();if(saved)dialog.close();else document.getElementById('artStatus').textContent='Applied for now; browser storage is unavailable.';});
    document.getElementById('resetAppearance').addEventListener('click',()=>{delete settings[active];save();apply();dialog.close();});
    window.addEventListener('storage',e=>{if(e.key===KEY){read();apply();}});
    new MutationObserver(apply).observe(document.body,{attributes:true,attributeFilter:['data-preset']});
    apply();
  }
  document.addEventListener('DOMContentLoaded',setup,{once:true});
  return {apply,validate,assets,preference};
})();
