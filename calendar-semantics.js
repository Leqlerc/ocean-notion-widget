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
    if (/\b(exam|midterm|finals?)\b/i.test(text)) return categories.exam;
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
  function cleanName(event) {
    const name=String(event?.name||'');
    if(classify(event).key!=='class')return name;
    return name
      .replace(/\s+(?:[-–—|:]\s*)?(?:Section|Sec\.?)[\s#]*[A-Z0-9-]+\s*$/i,'')
      .replace(/\s+\d{4,6}-[A-Z0-9]{2,4}\s*$/i,'')
      .trim();
  }
  return {categories,classify,highest,workloadLevel,significant,cleanName};
})();
