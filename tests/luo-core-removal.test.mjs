import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';

test('the retired Luo Core cat is absent from app source and packaged assets',async()=>{
 const source=await readFile('src/app.js','utf8'),build=await readFile('build.mjs','utf8');
 assert.doesNotMatch(source,/installLuoCore|luoCore\.signedOut/);
 assert.doesNotMatch(build,/buildLuoCoreModel|LUO_CORE_SAVE_OFFLINE|CORE_MODEL=/);
 assert.ok(!(await readdir('dist')).some(name=>/luo-core.*\.(glb|gltf|bin)$/.test(name)));
 const html=await readFile('dist/index.html','utf8');assert.match(html,/manifest\.json/);
 assert.doesNotMatch(html,/luo-core-model-hash/);
});

test('updating the service worker removes old cat caches but preserves unrelated data',async()=>{
 const sw=await readFile('dist/sw.js','utf8'),events={},deleted=[];
 const current=sw.match(/const CACHE='([^']+)'/)[1];
 const context={self:{addEventListener:(name,handler)=>{events[name]=handler},clients:{claim:async()=>{}}},caches:{keys:async()=>['luo-core-master-old','luo-core-master-new',current,'luo-chat-obsolete','unrelated-cache'],delete:async key=>{deleted.push(key)}},Promise};
 vm.runInNewContext(sw,context);let done;events.activate({waitUntil:p=>{done=p}});await done;
 assert.deepEqual(deleted.sort(),['luo-chat-obsolete','luo-core-master-new','luo-core-master-old']);
});

test('new Social stylesheet is content-versioned and available in the offline shell',async()=>{
 const html=await readFile('dist/index.html','utf8'),sw=await readFile('dist/sw.js','utf8');
 const css=html.match(/href="(\/luo-social-feed-[a-f0-9]{12}\.css)"/)?.[1];assert.ok(css);
 const shell=JSON.parse(sw.match(/SHELL=(\[[^;]+\]);/)[1]);assert.ok(shell.includes(css));
 assert.ok((await readFile('dist'+css,'utf8')).includes('scroll-snap-type:y mandatory'));
});
