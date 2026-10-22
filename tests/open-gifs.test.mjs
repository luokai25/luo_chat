import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const js=await readFile('public/klipy-gifs.js','utf8');
const css=await readFile('public/klipy-gifs.css','utf8');
const cfg=JSON.parse(await readFile('vercel.json','utf8'));
const csp=cfg.headers.flatMap(x=>x.headers||[]).find(x=>x.key==='Content-Security-Policy').value;
test('public Commons GIFs are searchable without key and require license and attribution',()=>{
 assert.match(js,/https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
 assert.ok(js.includes('filemime:"image/gif"'));
 assert.match(js,/origin:'\*'/);
 assert.match(js,/Api-User-Agent/);
 assert.match(js,/LicenseShortName/);
 assert.match(js,/Artist/);
 assert.match(js,/safeSource\(item\.source\)/);
 assert.match(js,/\(\$\{item\.license\}/);
 assert.match(js,/Wikimedia rate limit reached/);
 assert.match(js,/credentials:'omit'/);
 assert.doesNotMatch(js,/supabase\.storage|upload\(/);
});
test('commercial KLIPY remains optional and is not required for Commons search',()=>{
 assert.match(js,/klipyAvailable=false/);
 assert.match(js,/checkKLIPY/);
 assert.match(js,/Free GIFs/);
 assert.match(js,/Powered by KLIPY/);
 assert.match(js,/50 custom stickers|sticker/i);
});
test('allowed hosts are narrow and PWA CSP remains locked down',()=>{
 assert.match(js,/upload\.wikimedia\.org/);
 assert.match(js,/\/wikipedia\/commons\//);
 assert.match(csp,/img-src 'self' data: blob: https:\/\/upload\.wikimedia\.org/);
 assert.match(csp,/connect-src 'self' https:\/\/commons\.wikimedia\.org/);
 assert.match(csp,/object-src 'none'/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.match(css,/\.klipy-provider-tabs/);
});
