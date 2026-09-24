const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require(process.env.DOM_MODULE||'jsdom');
const read=p=>fs.readFileSync(p,'utf8');
const dom=new JSDOM(read('athletics.html'),{url:'https://nocean.test',runScripts:'outside-only'}),w=dom.window;
w.eval(['nocean-shared.js','nocean-store.js','nocean-signals.js','nocean-dashboard-appearance.js'].map(read).join('\n')+';window.S=NOceanSignals;window.Store=NOceanStore;window.A=NOceanDashboardAppearance;');
assert.equal(w.document.getElementById('maintenanceList'),null);assert.equal(w.document.getElementById('summaryMaintenance'),null);
const habit=w.document.querySelector('.habits-card');assert(w.document.getElementById('sleepConsistency').compareDocumentPosition(habit)&w.Node.DOCUMENT_POSITION_FOLLOWING);
for(const [entry,type,level] of [[null,'nutrition',0],[{water:2},'nutrition',1],[{calories:100,protein:10},'nutrition',3],[{},'sleep',0],[{hours:8},'sleep',3]])assert.equal(w.S.consistency(entry,type).level,level);
const node=w.document.getElementById('nutritionConsistency');w.S.renderConsistency(node,{'2026-09-24':{protein:50},'2026-09-25':{protein:100,calories:2000}},'nutrition','2026-09-25');assert.equal(node.querySelectorAll('.activity-cell').length,182);assert.equal(node.querySelectorAll('.level-1').length,1);assert.equal(node.querySelectorAll('.level-3').length,1);
w.S.renderConsistency(node,{'2026-09-25':{hours:7},'2026-09-26':{hours:8}},'sleep','2026-09-25');assert.equal(node.querySelectorAll('.level-3').length,1);
assert.equal(w.S.progress([{date:'2026-09-23',completed:true},{date:'2026-09-24',completed:true}],'2026-09-24').week,1);
const accents=Object.entries(w.A.accents);assert.equal(accents.length,48);
for(const family of ['Red','Orange','Yellow','Green','Blue','Purple','Pink','Chrome']){
 const shades=accents.filter(([,a])=>a.family===family);assert.equal(shades.length,6);
 const brightness=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).reduce((a,b)=>a+b,0);
 shades.forEach(([,a],i)=>{assert.equal(a.shade,i+1);if(i)assert(brightness(a.accent)<brightness(shades[i-1][1].accent));});
}
const legacy=['ice','mint','lavender','rose','cream','white','blue','green','lilac','pink','peach','gray','denim','teal','purple','berry','sand','eclipse','navy','forest','plum','wine','copper','black','frost','pistachio','periwinkle','blush','lemon','silver','cyan','lime','iris','coral','gold','slate','azure','jade','orchid','ruby','orange','taupe','ocean','olive','amethyst','brick','ochre','charcoal'];
for(const accent of legacy){w.Store.saveSettings({appearance:{accent}});assert(w.A.accents[w.Store.settings().appearance.accent],accent);}
dom.window.close();
console.log('Corrective sprint passed: Athletics order, shared 26-week consistency maps, workout cutoff, eight ordered color families, and every legacy accent.');
