import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const directory='dist/client/_next/static/css';
const css=readdirSync(directory).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(directory,name),'utf8')).join('\n');
// A production minifier can keep only the prefixed property if it is written last.
// Chrome needs the standard property; validate built bytes, not just source CSS.
for(const saturation of [140,150]){
 const rules=css.match(/[^{}]*\{[^{}]*\}/g)||[];
 assert(rules.some(rule=>rule.includes('topbar')&&rule.includes('sidebar-container')&&rule.includes(`-webkit-backdrop-filter:blur(20px)saturate(${saturation}%)`)&&rule.includes(`;backdrop-filter:blur(20px)saturate(${saturation}%)`)),`Production navigation blur ${saturation}% lost its standard declaration`);
}
console.log('PASS: compiled navigation CSS retains standard and WebKit backdrop filters.');
assert((css.match(/[^{}]*\{[^{}]*\}/g)||[]).some(rule=>rule.includes('.theme-toggle')&&rule.includes(';backdrop-filter:blur(12px)saturate(125%)')), 'Production theme switch lost its standard backdrop filter');
console.log('PASS: compiled theme switch retains its standard backdrop filter.');
