'use strict';
const Deadlines = (() => {
  const pad = n => String(n).padStart(2,'0');
  function fields(value) {
    if (!value) return {date:'',time:''};
    if (value.length===10) return {date:value,time:''};
    const d=new Date(value);
    return {date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};
  }
  function serialize(date,time='') {
    if (!date) return null;
    const d=new Date(`${date}T${time || '23:59'}:00`);
    if (!Number.isFinite(d.getTime())) throw new Error('Choose a valid deadline.');
    // Preserve the selected local day and its offset, including DST on that day.
    const offset=-d.getTimezoneOffset(), sign=offset<0?'-':'+';
    return `${date}T${time || '23:59'}:00${sign}${pad(Math.floor(Math.abs(offset)/60))}:${pad(Math.abs(offset)%60)}`;
  }
  function label(value) {
    if (!value) return '';
    const timed=value.length>10;
    const d=new Date(timed?value:value+'T12:00:00');
    const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(d);
    return date+(timed?' · '+new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d):'');
  }
  return {fields,serialize,label};
})();
