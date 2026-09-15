const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c=vm.createContext({document:{addEventListener(){}},fetch(){throw new Error('Cosmetics must not fetch application data');}});vm.runInContext(fs.readFileSync('nocean-appearance.js','utf8'),c);const run=s=>vm.runInContext(s,c);
assert.equal(run(`NOceanAppearance.validate({image:'https://elsewhere.invalid/x',tint:'unknown',visibility:'invisible'},'kelp-forest').image`),'kelp-forest');
assert.equal(run(`NOceanAppearance.validate({image:'none',tint:'Reef',visibility:'Strong'}).tint`),'Reef');
assert.equal(run(`Object.keys(NOceanAppearance.assets).length`),10);
console.log('Cosmetic asset allowlist and safe defaults passed.');
