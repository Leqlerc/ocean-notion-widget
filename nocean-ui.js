'use strict';
// Same controls and same theme preference on every page. No data fetching here.
const NOceanUI = (() => {
  const THEME_KEY = 'nocean.decorated';
  const PRESET_KEY = 'nocean.preset';
  function setPreset(value,persist=true){
    const preset=['default','card-art','experimental'].includes(value)?value:'default';
    document.body.dataset.preset=preset;
    const select=document.getElementById('themePreset');if(select)select.value=preset;
    if(persist)try{localStorage.setItem(PRESET_KEY,preset);}catch{}
  }
  function setTheme(decorated, persist = true) {
    document.body.classList.toggle('decorated', decorated);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(decorated));
      toggle.textContent = decorated ? 'Decorated' : 'Minimal';
    }
    if (persist) try { localStorage.setItem(THEME_KEY, String(decorated)); } catch { /* Private storage must not block the app. */ }
  }
  function shortcutAction(event, dialogOpen) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return null;
    if (event.key === 'Escape' && dialogOpen) return 'close';
    if (dialogOpen || event.target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return null;
    if (event.shiftKey && event.key !== '?') return null;
    return {n:'new', '/':'new', '1':'today','2':'tomorrow','3':'later',r:'refresh','?':'help'}[event.key.toLowerCase()] || null;
  }
  function setup() {
    const root = document.querySelector('[data-app-controls]');
    if (!root) return;
    const page=document.body.dataset.page;const home=page==='home';const taskPage=page==='tasks';
    root.innerHTML = `<nav class="page-nav" aria-label="Main navigation">${[['home','/','Home'],['projects','/projects.html','Projects'],['athletics','/athletics.html','Athletics'],['settings','/integrations.html','Settings']].map(([key,url,label])=>`<a href="${url}" ${page===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav><button id="shortcutHelp" class="quiet shortcut-hint" aria-label="Keyboard shortcuts">${home ? 'N to add · ' : ''}? Shortcuts</button>`;
    const help = document.createElement('dialog');
    help.id = 'shortcutDialog'; help.setAttribute('aria-labelledby','shortcutTitle');
    help.innerHTML = '<div class="card-head"><h2 id="shortcutTitle">Keyboard shortcuts</h2><button class="quiet" id="closeShortcuts" aria-label="Close shortcuts">✕</button></div><dl class="shortcut-list"><dt><kbd>N</kbd> / <kbd>/</kbd></dt><dd>New task (Home)</dd><dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>Today / Tomorrow / Backlog (Home)</dd><dt><kbd>R</kbd></dt><dd>Refresh this page’s data</dd><dt><kbd>Esc</kbd></dt><dd>Close an open dialog</dd><dt><kbd>?</kbd></dt><dd>Show this help</dd></dl><p class="section-note">Shortcuts pause while you type or use an editor.</p>';
    document.body.append(help);
    let decorated = true;
    try { const saved=localStorage.getItem(THEME_KEY); decorated=saved===null?true:saved==='true'; } catch {}
    setTheme(decorated, false);
    let preset='default';try{preset=localStorage.getItem(PRESET_KEY)||'default';}catch{}
    {setPreset(preset,false);const select=document.getElementById('themePreset');if(select)select.addEventListener('change',e=>setPreset(e.target.value));}
    document.getElementById('shortcutHelp').addEventListener('click', () => help.showModal());
    document.getElementById('closeShortcuts').addEventListener('click', () => help.close());
    window.addEventListener('storage', event => { if (event.key === THEME_KEY) setTheme(event.newValue === 'true', false); if(event.key===PRESET_KEY)setPreset(event.newValue,false); });
    document.addEventListener('keydown', event => {
      const open = document.querySelector('dialog[open]');
      const action = shortcutAction(event, Boolean(open));
      if (!action) return;
      if (action === 'close') { event.preventDefault(); open.close(); return; }
      if (action === 'help') { event.preventDefault(); help.showModal(); return; }
      if (action === 'refresh') { event.preventDefault(); document.getElementById('refresh')?.click(); return; }
      if (!home&&!taskPage) return;
      event.preventDefault();
      if (action === 'new') document.getElementById('taskName')?.focus();
      else document.querySelector(taskPage?`[data-view="${action}"]`:`[data-tab="${action}"]`)?.click();
    });
  }
  document.addEventListener('DOMContentLoaded', setup, {once:true});
  return {shortcutAction, setTheme, setPreset};
})();
