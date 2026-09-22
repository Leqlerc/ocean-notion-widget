const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({Intl,Date,URL,document:{},setTimeout,clearTimeout,AbortController});
vm.runInContext(fs.readFileSync('nocean-shared.js','utf8'),context);
for(const [percent,level] of [[null,0],[0,1],[14,1],[15,2],[24,2],[25,3],[39,3],[40,4],[74,4],[75,5],[100,5]]){
 const html=vm.runInContext(`NOcean.renderFacilities({spaces:{corec_lower:{percent:${percent}}},corec_hours:{closed:false}})`,context);
 assert.ok(html.includes('occupancy-'+level));assert.equal(vm.runInContext(`NOcean.occupancyLevel(${percent})`,context),level);if(percent===null)assert.ok(html.includes('Occupancy unavailable'));
}
assert.ok(vm.runInContext('NOcean.renderFacilities({spaces:{corec_lower:{percent:95}},corec_hours:{closed:true}})',context).includes('occupancy-0'));
assert.ok(!fs.readFileSync('calendar-labels.js','utf8').includes("month:'short'"));
let callback,ticks=0;const elements={welcomeTime:{},welcomeDate:{},welcomeLine:{}};
vm.runInNewContext(fs.readFileSync('nocean-welcome.js','utf8'),{Intl,Date,document:{getElementById:id=>elements[id],addEventListener(){}},setInterval:(fn,ms)=>{assert.equal(ms,1000);callback=fn;ticks++}});
assert.equal(ticks,1);assert.match(elements.welcomeTime.textContent,/\d+:\d+:\d+/);callback();
console.log('Exact five-level facility occupancy, full month, and one-second local clock passed.');
