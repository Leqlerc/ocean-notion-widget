'use strict';
// Shared presentation/transport utilities; pages keep their own provider state.
const NOcean = (() => {
  const CONFIG = {
    timezone: 'America/Indiana/Indianapolis',
    calendarRefresh: 45000, taskRefresh: 90000, campusRefresh: 300000,
    weather: 'https://api.open-meteo.com/v1/forecast?latitude=40.4237&longitude=-86.9212&current=temperature_2m,weather_code&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FIndiana%2FIndianapolis&forecast_days=2'
  };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:CONFIG.timezone, year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const dateDay = value => !value ? '' : value.length === 10 ? value : dayKey(new Date(value));
  const dateObject = value => new Date(value.length === 10 ? value + 'T12:00:00-04:00' : value);
  const shortDate = value => new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,month:'short',day:'numeric'}).format(dateObject(value));
  const timeLabel = value => new Intl.DateTimeFormat('en-US',{timeZone:CONFIG.timezone,hour:'numeric',minute:'2-digit'}).format(new Date(value));
  const empty = text => `<p class="empty">${esc(text)}</p>`;
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch(url, {...options, signal:controller.signal, cache:'no-store', headers:{...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers}});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connection failed. Please try again.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Request timed out. Refresh before retrying.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function facility(name, counter, hours, scope) {
    const percent = counter?.percent;
    const load = percent == null ? '' : `${percent}% · ${percent < 30 ? 'Quiet' : percent < 60 ? 'Moderate' : percent < 85 ? 'Busy' : 'Very busy'}`;
    const closed = hours?.closed ?? counter?.closed;
    const status = closed == null ? 'Status unavailable' : closed ? 'Closed' : 'Open';
    const level = closed !== false ? (closed ? 'closed' : 'unknown') : percent == null ? 'open' : percent < 30 ? 'low' : percent < 60 ? 'moderate' : percent < 85 ? 'busy' : 'very-busy';
    return `<div class="facility-status status-${level}"><div class="facility-title"><a href="https://www.purdue.edu/recwell/" target="_blank" rel="noopener">${esc(name)}</a><span class="badge crowd-badge crowd-${level}" title="${esc(counter?.updated ? 'Latest count: '+counter.updated : 'No occupancy counter available')}">● ${status}${closed === false && load ? ' · '+esc(load) : ''}</span></div><div class="facility-meta">${esc(hours?.hours || 'Hours unavailable')} · ${esc(percent == null ? 'occupancy unavailable' : scope)}</div></div>`;
  }
  const renderFacilities = data => facility('B&G Gym', data.spaces?.corec_lower, data.corec_hours, 'CoRec hours · B&G count') + facility('Aquatic Center', data.spaces?.aquatic, data.aquatic_hours, 'pool count');
  return {CONFIG,$,esc,safeURL,dayKey,dateDay,dateObject,shortDate,timeLabel,empty,request,renderFacilities};
})();
