import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/luo-secondary-v7.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('authentication blocks concurrent requests while pending',()=>{
 assert.match(app,/async function auth\(kind\)\{if\(busy\)return;/);
 assert.match(app,/busy=true;const authButton=/);
 assert.match(app,/authButton\.setAttribute\('aria-busy','true'\)/);
 assert.match(app,/\$\('signin'\)\.disabled=\$\('signup'\)\.disabled=true/);
 assert.match(app,/finally\{busy=false;authButton\.textContent=previousLabel;/);
 assert.match(app,/authButton\.removeAttribute\('aria-busy'\)/);
});
test('processing state and timestamp design are loaded by same app shell',()=>{
 assert.match(html,/href="\/luo-secondary-v7\.css"/);
 assert.match(css,/#auth \.primary\.luo-auth-processing/);
 assert.match(css,/#room #messages \.bubble>\.stamp/);
 assert.match(css,/\.bubble:focus-within>\.stamp/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('message stamps remain available to search and export',()=>{
 assert.match(app,/querySelector\('\.stamp'\)/);
 assert.match(app,/function filterRoomMessages\(/);
 assert.match(app,/exportChat/);
});
