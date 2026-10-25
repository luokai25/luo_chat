import {readFile,access,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const html=await readFile('dist/index.html','utf8'),manifest=JSON.parse(await readFile('dist/manifest.json','utf8')),sw=await readFile('dist/sw.js','utf8');
for(const path of [...html.matchAll(/(?:src|href)="(\/[^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1])){
 try{await access('dist'+path)}catch{await access('dist'+path+'.html')}
}
for(const icon of manifest.icons)await access('dist'+icon.src);
const shell=JSON.parse(sw.match(/SHELL=(\[[^;]+\]);/)[1]);for(const path of shell)await access('dist'+path);
assert.ok(shell.every(path=>path.startsWith('/')&&!path.includes('supabase')&&!path.includes('/api')));
assert.match(html,/app-[A-Z0-9]+\.js/);assert.match(html,/style-[a-f0-9]+\.css/);assert.match(html,/icon-[a-f0-9]{12}\.svg/);assert.match(html,/href="\/manifest\.json"/);
const callStyle=html.match(/href="(\/luo-call-quality-[a-f0-9]{12}\.css)"/)?.[1];assert.ok(callStyle,'Call styles must have a content-addressed URL');assert.ok(shell.includes(callStyle));
assert.equal(callStyle,'/luo-call-quality-'+createHash('sha256').update(await readFile('dist'+callStyle)).digest('hex').slice(0,12)+'.css');
assert.equal(manifest.id,'/');assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
assert.notEqual(manifest.icons.find(icon=>icon.purpose==='maskable').src,manifest.icons.find(icon=>icon.sizes==='512x512'&&icon.purpose==='any').src);
assert.match(html,/icon-32-[a-f0-9]{12}\.png/);assert.match(html,/apple-touch-icon/);assert.match(sw,/ACTIVATE_UPDATE/);
console.log('PASS: hashed assets, manifest icons, and offline-shell references are complete');
const release=JSON.parse(await readFile('package.json','utf8')).version;
assert.ok(html.includes('<meta name="luo-version" content="'+release+'">'));assert.ok(html.includes('<span id="appVersion">'+release+'</span>'));
assert.match(html,/google-site-verification/);
for(const id of ['googleSignIn','googleAuthStatus','retryGoogleAuth'])assert.ok(!html.includes('id="'+id+'"'), 'Unconfigured Google OAuth control must not be included in production HTML: '+id);
assert.ok(html.includes('id="signin"')&&html.includes('id="forgot"'),'Email password sign-in and recovery must remain available');
console.log('PASS: version '+release+', app identity, and Google verification are retained');
const names=await readdir('dist/stickers/luo-family');
assert.equal(names.length,50);assert.ok(names.every(n=>/^luo50-(?:0[1-9]|[1-4][0-9]|50)\.png$/.test(n)));
for(let i=1;i<=50;i++)await access('dist/stickers/luo-family/luo50-'+String(i).padStart(2,'0')+'.png');
const appPath=html.match(/src="(\/app-[A-Z0-9]+\.js)"/)?.[1];assert.ok(appPath);
const app=await readFile('dist'+appPath,'utf8');
assert.equal(appPath,'/app-'+createHash('sha256').update(app).digest('hex').slice(0,16).toUpperCase()+'.js','App filename must address emitted bytes, not a source-path-dependent graph hash');
assert.deepEqual((await readdir('dist')).filter(name=>/^app-[A-Z0-9]+\.js$/.test(name)),[appPath.slice(1)],'Only the referenced app bundle may be packaged');
assert.ok(app.includes('luo50-01')&&app.includes('luo50-50'));
assert.ok(!app.includes('200 original stickers'));
assert.ok(app.includes('50 premium stickers'));
console.log('PASS: exactly 50 new stickers packaged and picker updated; none of the original 200 packaged.');
await import('./check-web-budgets.mjs');
const connectionChecks=await readFile('dist/connection-checks.js','utf8');
for(const m of connectionChecks.matchAll(/\/(?:app-[A-Z0-9]+\.js|style-[a-f0-9]+\.css|icon-192-[a-f0-9]+\.png)/g))await access('dist'+m[0]);
console.log('PASS: connection diagnostic asset URLs point to this build');
