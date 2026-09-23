(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let csrf = '', editing = null, operationId = crypto.randomUUID(), busy = false, lastRequest = '';
  let reviewedDuplicates=null;
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
    busy = true; document.querySelectorAll('.integration-main button').forEach(b => { b.disabled = true; });
    try { await action(); } catch (error) { message(error.message); }
    finally { busy = false; document.querySelectorAll('.integration-main button').forEach(b => { b.disabled = false; }); }
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
      const remaining=Number(account?.progress?.remaining)||0;
      $(provider + 'Status').textContent = account ? `Connected · ${account.label} · ${account.sync_status}${remaining?' · Incomplete: '+remaining+' remaining':''} · Last successful sync: ${account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'not yet'}${account.sync_error ? ' · ' + account.sync_error : ''}` : 'Not connected';
      if(account?.scheduled)$(provider+'Status').textContent+=` · Last cron-route completion: ${new Date(account.scheduled.at).toLocaleString()}${account.scheduled.result?.remaining?' (partial)':''}`;
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
    const created=Number(result.created)||0,updated=Number(result.updated)||0,unchanged=Number(result.unchanged)||0,archived=Number(result.archived)||0,remaining=Number(result.remaining)||0,skippedPast=Number(result.skippedPast)||0,skippedFeed=Number(result.skipped)||0;
    const discovered=created+updated+unchanged+archived+remaining+skippedPast;
    const skipped=archived+skippedPast+skippedFeed;
    message(`${discovered} discovered · ${created} created · ${updated} adopted/updated · ${unchanged} unchanged · ${skipped} skipped (${skippedPast} past, ${archived} archived, ${skippedFeed} feed entries). ${remaining ? remaining + ' remain; sync again to continue.' : 'Coursework sync complete · no reconciliation warnings.'}`);
  }));
  const reviewButton=document.createElement('button');reviewButton.type='button';reviewButton.id='reviewBrightspace';reviewButton.textContent='Review duplicate coursework';
  const reviewReport=document.createElement('div');reviewReport.id='brightspaceReview';
  const applyButton=document.createElement('button');applyButton.type='button';applyButton.id='applyBrightspaceReview';applyButton.textContent='Archive reviewed redundant imports';applyButton.hidden=true;
  $('syncBrightspace').after(reviewButton,reviewReport,applyButton);
  reviewButton.addEventListener('click',()=>run(async()=>{
    reviewedDuplicates=await request('/api/integrations',{action:'brightspace-review'});
    reviewReport.replaceChildren();const summary=document.createElement('p');summary.textContent=`${reviewedDuplicates.pairs.length} deterministic duplicates · ${reviewedDuplicates.conflicts.length} conflicts preserved.`;reviewReport.append(summary);
    for(const pair of reviewedDuplicates.pairs){const row=document.createElement('p');row.textContent=`${pair.name} → retain ${pair.keep}`;reviewReport.append(row);}
    applyButton.hidden=!reviewedDuplicates.pairs.length;
  }));
  applyButton.addEventListener('click',()=>run(async()=>{
    if(!reviewedDuplicates)return;
    const result=await request('/api/integrations',{action:'brightspace-reconcile',digest:reviewedDuplicates.digest});
    reviewedDuplicates=null;applyButton.hidden=true;reviewReport.textContent=`${result.archived} redundant imports archived; ${result.remaining} remain. Review again for the next batch.`;await load();
  }));
  const result = new URLSearchParams(location.search).get('outlook');
  if (result) { history.replaceState({},'',location.pathname); message(result === 'connected' ? 'Outlook connected. Sync now to load events.' : 'Microsoft connection failed or was cancelled. Check setup and try again.'); }
  run(load);
})();
