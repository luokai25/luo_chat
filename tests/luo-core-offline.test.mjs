import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isInstalledLuoChat,saveLuoCoreOffline,luoCoreOfflineStatus} from '../src/luo-core-offline.js';

test('installed Luo Chat identifies standalone browser mode and iOS homescreen',()=>{
 assert.equal(isInstalledLuoChat({matchMedia:()=>({matches:true}),navigator:{}}),true);
 assert.equal(isInstalledLuoChat({matchMedia:()=>({matches:false}),navigator:{standalone:true}}),true);
 assert.equal(isInstalledLuoChat({matchMedia:()=>({matches:false}),navigator:{standalone:false}}),false);
});
test('regular web browsing never downloads the multi-megabyte full cat model automatically',async()=>{
 let calls=0;
 const win={matchMedia:()=>({matches:false}),navigator:{standalone:false,onLine:true},
 fetch:()=>{calls++;throw Error('Browser must not fetch high-poly model')}};
 const result=await saveLuoCoreOffline(win);
 assert.equal(result.reason,'browser-not-installed');
 assert.equal(calls,0);
});
test('high-res model is stored on installed PWA and available offline after first download',async()=>{
 const stored=new Map();
 const cache={match:async path=>stored.get(path),put:async(path,response)=>stored.set(path,response)};
 const bytes=Buffer.alloc(150000);bytes.write('glTF',0);bytes.writeUInt32LE(2,4);
 let fetches=0;
 const win={
  matchMedia:()=>({matches:true}),navigator:{onLine:true},isSecureContext:true,
  caches:{match:async path=>stored.get(path),open:async()=>cache},
  fetch:async()=>{fetches++;return new Response(bytes,{status:200})}
 };
 const status=await saveLuoCoreOffline(win);
 assert.equal(status.ready,true);
 assert.equal(fetches,1);
 assert.equal((await luoCoreOfflineStatus(win)).ready,true);
 win.navigator.onLine=false;
 assert.equal((await saveLuoCoreOffline(win)).ready,true,'cached model works without internet');
 assert.equal(fetches,1,'offline use makes no network request');
});
test('invalid 3D content cannot poison offline model cache',async()=>{
 const stored=new Map();
 const cache={match:async path=>stored.get(path),put:async(path,r)=>stored.set(path,r)};
 const win={
  matchMedia:()=>({matches:true}),navigator:{onLine:true},
  caches:{match:async path=>stored.get(path),open:async()=>cache},
  fetch:async()=>new Response(Buffer.alloc(160000),{status:200})
 };
 const result=await saveLuoCoreOffline(win);
 assert.equal(result.reason,'invalid-glb');
 assert.equal(stored.size,0);
});
test('compiled installable web bundle contains the full 3D cat and does not gate PWA shell on HD download',async()=>{
 const data=await readFile('dist/luo-core-master.glb');
 assert.equal(data.toString('ascii',0,4),'glTF');
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString('utf8'));
 assert.ok(gltf.extras.luoCore.triangularFaces>=100000);
 assert.equal(gltf.animations.length,28);
 assert.ok(gltf.nodes.some(node=>node.name==='Head'));
 assert.ok(gltf.nodes.some(node=>node.name==='FrontPawL'));
 const sw=await readFile('dist/sw.js','utf8');
 const shell=JSON.parse(sw.match(/SHELL=(\[[^;]+\]);/)[1]);
 assert.equal(shell.includes('/luo-core-master.glb'),false);
 assert.match(sw,/CORE_CACHE/);
 assert.match(sw,/LUO_CORE_SAVE_OFFLINE/);
});
