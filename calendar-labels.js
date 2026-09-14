'use strict';
// Presentation enhancement for the month grid: keep exact important event names visible.
renderCalendar = function renderCalendarWithLabels() {
  const [year,month] = state.month.split('-').map(Number);
  const first = new Date(Date.UTC(year,month-1,1));
  $('monthTitle').textContent = first.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',year:'numeric'});
  const start = new Date(first);
  start.setUTCDate(1-first.getUTCDay());
  let html = ['S','M','T','W','T','F','S'].map(d => `<span class="weekday">${d}</span>`).join('');

  for (let n=0;n<42;n++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate()+n);
    const day = date.toISOString().slice(0,10);
    const events = state.events.filter(e => eventOnDay(e,day));
    const semantic = CalendarSemantics.highest(events);
    const classes = ['day', semantic ? 'event-'+semantic.key : '', day.slice(0,7)!==state.month?'other':'', day===dayKey()?'today':'', day===state.selectedDay?'selected':'', events.length?'has-events':'', events.some(importantEvent)?'important':''].join(' ');

    const labelled = events
      .filter(e => CalendarSemantics.classify(e).key !== 'class')
      .sort((a,b) => CalendarSemantics.classify(b).priority - CalendarSemantics.classify(a).priority || a.at.localeCompare(b.at));
    const visible = labelled.slice(0,2);
    const labels = visible.map(e => {
      const kind = CalendarSemantics.classify(e);
      return `<span class="calendar-event-label event-${kind.key}" title="${esc(e.name)}">${esc(e.name)}</span>`;
    }).join('');
    const more = labelled.length > visible.length ? `<span class="calendar-event-more">+${labelled.length-visible.length} more</span>` : '';
    const eventNames = events.map(e=>e.name).join('; ');

    html += `<button class="${classes}" data-day="${day}" aria-label="${day}, ${events.length} events${events.length ? ': '+esc(eventNames) : ''}" aria-pressed="${day===state.selectedDay}" title="${esc(events.map(e=>e.name).join('\n') || 'No events')}"><span class="day-number">${date.getUTCDate()}</span>${labels || (semantic && semantic.key !== 'class' ? `<span class="day-type">${esc(semantic.short || semantic.label)}</span>` : '')}${more}</button>`;
  }
  $('calendarGrid').innerHTML = html;
};
