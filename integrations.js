(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let csrf = '', editing = null, operationId = crypto.randomUUID(), busy = false, lastRequest = '';
  const message = value => { $('message').textContent = value; };
  async function request(path, data, method = 'POST') {
    const response = await fetch(path, { method: data ? method : 'GET', credentials: 'same-origin',
      headers: data ? { 'Content-Type': 'application/json', 'X-NOcean-CSRF': csrf } : {},
      body: data ? JSON.stringify(data) : undefined });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Request failed. Try again.');
    return result;
  }
  async function run(action) {
    if (busy) return;
    busy = true; document.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { await action(); } catch (error) { message(error.message); }
    finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  function localInput(value) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  }
  function resetEvent() {
    editing = null; operationId = crypto.randomUUID(); lastRequest = '';
    $('eventForm').reset(); $('eventHeading').textContent = 'Create an Outlook event'; $('saveEvent').textContent = 'Create event';
  }
  async function load() {
    const state = await request('/api/integration-session'); csrf = state.csrf || '';
    $('access').hidden = state.authenticated; $('workspace').hidden = !state.authenticated;
    if (!state.authenticated) { if (!state.configured) message('Connections need one-time server setup. Existing Tasks and calendars still work.'); return; }
    const data = await request('/api/integrations');
    if (!data.ready) { message(data.error); return; }
    for (const provider of ['outlook','brightspace']) {
      const account = data.accounts.find(a => a.provider === provider);
      $(provider + 'Status').textContent = account ? `${account.label} · ${account.sync_status} · Last sync: ${account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'not yet'}${account.sync_error ? ' · ' + account.sync_error : ''}` : 'Not connected';
    }
    if (!data.outlookConfigured) $('outlookStatus').textContent += ' · Microsoft app setup required';
    $('events').replaceChildren();
    const events = (data.events || []).sort((a,b) => a.at.localeCompare(b.at));
    for (const event of events) {
      const row = document.createElement('div'); row.className = 'integration-event';
      const text = document.createElement('span'); text.textContent = `${event.name} · ${new Date(event.at).toLocaleString()}`; row.append(text);
      if (event.editable && event.at.length > 10) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Edit';
        button.addEventListener('click', () => {
          editing = event; $('eventName').value = event.name; $('eventStart').value = localInput(event.at); $('eventEnd').value = localInput(event.end);
          $('eventHeading').textContent = 'Edit Outlook event'; $('saveEvent').textContent = 'Save changes'; $('eventName').focus();
        }); row.append(button);
      }
      $('events').append(row);
    }
  }
  $('login').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const secret = $('ownerSecret').value; $('ownerSecret').value = '';
    await request('/api/integration-session', {secret}); await load(); message('Connections unlocked.');
  }); });
  $('logout').addEventListener('click', () => run(async () => {
    await request('/api/integration-session',{action:'logout'}); resetEvent(); $('events').replaceChildren(); await load(); message('Connections locked.');
  }));
  $('connectOutlook').addEventListener('click', () => run(async () => {
    const data = await request('/api/integrations',{action:'outlook-connect'}); location.assign(data.url);
  }));
  $('syncOutlook').addEventListener('click', () => run(async () => {
    const result = await request('/api/integrations',{action:'outlook-sync'}); await load(); message(`${result.count} Outlook events synced. Home will show the refreshed calendar.`);
  }));
  $('eventForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const data = {action:'outlook-save',name:$('eventName').value,at:new Date($('eventStart').value).toISOString(),end:new Date($('eventEnd').value).toISOString()};
    if (editing) { data.externalId = editing.externalId; data.etag = editing.etag; }
    else {
      const fingerprint = JSON.stringify(data);
      if (lastRequest && fingerprint !== lastRequest) throw Error('The previous save may have succeeded. Sync Outlook and check before starting a new event.');
      lastRequest = fingerprint; data.operationId = operationId;
    }
    await request('/api/integrations',data,editing ? 'PATCH' : 'POST'); resetEvent(); await load(); message('Outlook event saved.');
  }); });
  $('resetEvent').addEventListener('click', resetEvent);
  $('feedForm').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const url = $('feedUrl').value; $('feedUrl').value = '';
    const result = await request('/api/integrations',{action:'brightspace-connect',url}); await load(); message(`Feed connected: ${result.count} dated items found. Sync coursework to import them.`);
  }); });
  $('syncBrightspace').addEventListener('click', () => run(async () => {
    const result = await request('/api/integrations',{action:'brightspace-sync'}); await load();
    message(`${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged. ${result.remaining ? result.remaining + ' remain; sync again to continue.' : 'Coursework sync complete.'}`);
  }));
  const result = new URLSearchParams(location.search).get('outlook');
  if (result) { history.replaceState({},'',location.pathname); message(result === 'connected' ? 'Outlook connected. Sync now to load events.' : 'Microsoft connection failed or was cancelled. Check setup and try again.'); }
  run(load);
})();
