const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({Intl,Date,URL,document:{},setTimeout,clearTimeout,AbortController});
vm.runInContext(fs.readFileSync('nocean-shared.js','utf8'),context);
for(const [percent,level] of [[null,'open'],[10,'low'],[45,'moderate'],[75,'busy'],[95,'very-busy']]){
 const html=vm.runInContext(`NOcean.renderFacilities({spaces:{corec_lower:{percent:${percent}}},corec_hours:{closed:false}})`,context);
 assert.ok(html.includes('status-'+level));if(percent===null)assert.ok(html.includes('occupancy unavailable'));
}
assert.ok(vm.runInContext('NOcean.renderFacilities({spaces:{corec_lower:{percent:95}},corec_hours:{closed:true}})',context).includes('status-closed'));
assert.ok(!fs.readFileSync('calendar-labels.js','utf8').includes("month:'short'"));
let callback,ticks=0;const elements={welcomeTime:{},welcomeDate:{},welcomeLine:{}};
vm.runInNewContext(fs.readFileSync('nocean-welcome.js','utf8'),{Intl,Date,document:{getElementById:id=>elements[id]},setInterval:(fn,ms)=>{assert.equal(ms,1000);callback=fn;ticks++}});
assert.equal(ticks,1);assert.match(elements.welcomeTime.textContent,/\d+:\d+:\d+/);callback();
console.log('Facility levels, full month, and one-second local clock passed.');
