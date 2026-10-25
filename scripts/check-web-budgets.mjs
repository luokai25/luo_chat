import {readFile,readdir} from 'node:fs/promises';import {gzipSync} from 'node:zlib';import assert from 'node:assert/strict';
const names=await readdir('dist'),app=names.find(n=>/^app-[A-Z0-9]+\.js$/.test(n));assert.ok(app);
const appGzip=gzipSync(await readFile('dist/'+app)).length;
// Measure the unique CSS URLs actually linked by the public pages, rather
// than counting legacy unreferenced stylesheet copies as network requests.
const linked=new Set();for(const n of names.filter(n=>n.endsWith('.html'))){const html=await readFile('dist/'+n,'utf8');for(const m of html.matchAll(/href="(\/[^"?]+\.css)(?:\?[^\"]*)?"/g))linked.add(m[1])}
let cssGzip=0;for(const n of linked)cssGzip+=gzipSync(await readFile('dist'+n)).length;
const ogBytes=(await readFile('dist/og-image.png')).length;
// Regression ceilings, not a claim that these budgets guarantee field CWV.
assert.ok(appGzip<=250000,'App gzip exceeds 250 KB: split non-critical features before release');assert.ok(cssGzip<=85000,'Combined CSS gzip exceeds 85 KB');assert.ok(ogBytes<=300000,'Share image exceeds 300 KB');
console.log('PASS: web payload budgets '+JSON.stringify({appGzip,cssGzip,ogBytes})+'. Real LCP, INP and CLS still require lab/field measurement.');
