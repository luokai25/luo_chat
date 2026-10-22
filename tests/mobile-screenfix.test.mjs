import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('mobile selects exactly one screen, not desktop split panes',async()=>{
const s=await readFile('public/luo-screenfix.css','utf8');
for(const x of ['.app[data-screen="home"] main>#room','.app[data-screen="room"] main>#home','.app[data-screen="home"] main>#home','.app[data-screen="room"] main>#room','display:none!important','max-width: 999px','#luoUpdatesStrip','.suite-toolbar'])assert.ok(s.includes(x),x);
});
test('mobile patch executes after all design CSS and updates the service-worker cache',async()=>{
const p=JSON.parse(await readFile('package.json','utf8')).scripts.build;
const apply=p.indexOf('node scripts/apply-screenfix.mjs'),build=p.indexOf('node build.mjs'),last=p.indexOf('node scripts/revision-screenfix.mjs'),verify=p.indexOf('node scripts/verify-build.mjs');
assert.ok(apply>0&&build>apply&&last>build&&verify>last);
});
test('production source retains Google ownership verification',async()=>{
const html=await readFile('public/index.html','utf8');
assert.ok(html.includes('<meta name="google-site-verification" content="y09hvb9dhGQPvM_sozzO_Q3z09BT30HekpDvlDsVR-w" />'));
});