'use strict';
// One classification rule drives the month, event stack, labels, and legend.
const CalendarSemantics = (() => {
  const categories = {
    exam:{key:'exam',label:'Exam',priority:7},
    quiz:{key:'quiz',label:'Quiz',priority:6},
    assessment:{key:'assessment',label:'CFU / Practical',short:'CFU / Practical',priority:5},
    presentation:{key:'presentation',label:'Presentation / event',short:'Presentation',priority:4},
    personal:{key:'personal',label:'Personal / meetup',short:'Personal',priority:3},
    break:{key:'break',label:'Break',priority:2},
    class:{key:'class',label:'Class',priority:1}
  };
  function classify(event) {
    const text = `${event.type || ''} ${event.name || ''}`;
    if (/\b(exam|test|midterm|finals)\b/i.test(text) || /\bfinal\b/i.test(text) && !/\b(project|report|paper|presentation|assignment)\b/i.test(text)) return categories.exam;
    if (/\bquiz(?:zes)?\b/i.test(text)) return categories.quiz;
    if (/\b(cfu|practical)\b/i.test(text)) return categories.assessment;
    if (/\b(presentation|demo|demonstration|roundtable|conference)\b/i.test(text)) return categories.presentation;
    if (/\b(break|holiday|no class)\b/i.test(text)) return categories.break;
    if (event.type === 'Class' || /\b(lecture|recitation|class meeting)\b/i.test(text)) return categories.class;
    return categories.personal;
  }
  function highest(events) {
    return events.reduce((best,event) => {const current=classify(event); return !best || current.priority>best.priority ? current : best;},null);
  }
  function significant(event) {
    const category=classify(event).key;
    if(['exam','quiz','assessment','presentation','break'].includes(category))return true;
    if(category==='class')return false;
    return /\b(travel|flight|trip|interview|appointment|conference|ceremony|competition|tournament|special|important|major|gala|concert|club event)\b/i.test(`${event.type||''} ${event.name||''}`);
  }
  function workloadLevel(count) {
    const value=Math.max(0,Number(count)||0);
    return value>=5?5:Math.floor(value);
  }
  function announcement(item) {
    const text = `${item.name||''} ${item.type||''}`;
    return /\b(announcement|informational|content posted|module available)\b/i.test(text) || /\b(available|availability|opens?|posted|released)\b/i.test(text) && !/\b(due|deadline|submit by)\b/i.test(text);
  }
  function deadline(item) {
    const routine=/\b(lecture|recitation|class|meeting|club|appointment|interview)\b/i.test(item.name||'') && !/\b(exam|test|quiz|assignment|homework|report|due|submission)\b/i.test(item.name||'');
    return Boolean(item.due) && !announcement(item) && !routine && !/^(event|class|meeting)$/i.test(item.type||'');
  }
  function eventItem(item) {
    const text=`${item.name||''} ${item.type||''}`;
    return !announcement(item) && !/\b(assignment|homework|hw|report|submission|submit|deadline|due)\b/i.test(text) && !(/\bproject\b/i.test(text)&&classify(item).key!=='presentation');
  }
  function cleanEvents(items) {
    const eligible=items.filter(eventItem);
    // Only merge recitations with the same course and exact start instant.
    const course=e=>String(e.course||e.name||'').toUpperCase().match(/\b[A-Z]{2,5}\s*\d{3,5}\b/)?.[0].replace(/\s/g,'');
    return eligible.filter(e=>!(/\brecitation\b/i.test(e.name||'') && !significant(e) && eligible.some(q=>q!==e && /\brecitation\b/i.test(q.name||'') && significant(q) && course(e) && course(e)===course(q) && e.at && new Date(e.at).getTime()===new Date(q.at).getTime())));
  }
  return {categories,classify,highest,workloadLevel,significant,announcement,deadline,eventItem,cleanEvents};
})();
