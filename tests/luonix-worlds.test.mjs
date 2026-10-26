import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {installWorlds} from '../src/worlds.js';

function fixture(initial=[{kind:'community',id:'w1',title:'Golden Library',body:'Stories and agents',audience:'public',owner_id:'owner'}]){
 const dom=new JSDOM('<!doctype html><html><body><div class="app" data-screen="home" data-tab="group"><div id="group"><h2>Create group</h2><input id="groupname"><textarea id="members"></textarea><button id="createGroup">Create</button></div></div></body></html>',{url:'https://luo.example/'});
 const win=dom.window,doc=win.document;let actor={id:'member'},worlds=initial;
 const calls=[];const db={from:()=>({select(){return this},eq(){return this},is(){return this},order(){return this},limit(){return this},lt(){return this},then(ok){return Promise.resolve({data:[],error:null}).then(ok)}}),rpc:async(name,arg)=>{calls.push({name,...arg});if(arg.action==='feed')return {data:worlds};if(arg.action==='community.rooms')return {data:[{id:'r1',title:'general',conversation_id:'c1'}]};if(arg.action==='entry.create')return {data:{}};if(arg.action==='entry.publish'){worlds=[...worlds,{kind:'community',id:arg.input.id,title:'Created',audience:'public',owner_id:actor?.id}];return {data:{}}}return {data:{}};}};
 const opened=[];const api=installWorlds({win,db,$:id=>doc.getElementById(id),getUser:()=>actor,note:()=>{},openRoom:async id=>opened.push(id),refreshChats:async()=>{}});
 const flush=async()=>{for(let i=0;i<7;i++)await new Promise(ok=>setTimeout(ok,0))};
 return {doc,win,api,calls,opened,flush,setActor:v=>actor=v,close:()=>win.close()};
}

test('Worlds replaces the visible group form but preserves native group inputs for existing handlers',async()=>{
 const f=fixture();try{assert.ok(f.doc.querySelector('#group .worlds-app'));assert.ok(f.doc.querySelector('#group .worlds-legacy-group-creation[hidden]'));assert.ok(f.doc.getElementById('createGroup'));f.api.onTab('group');await f.flush();assert.match(f.doc.querySelector('.worlds-servers').textContent,/Golden Library/);assert.equal(f.calls.filter(c=>c.action==='feed').length,1)}finally{f.close()}
});
test('Worlds uses only server-authorized community memberships and room joining',async()=>{
 const f=fixture();try{f.api.onTab('group');await f.flush();f.doc.querySelector('.worlds-server').click();await f.flush();assert.ok(f.calls.some(c=>c.action==='community.rooms'&&c.input.id==='w1'));assert.match(f.doc.querySelector('.worlds-channels').textContent,/general/);f.doc.querySelector('.worlds-channel').click();await f.flush();const button=[...f.doc.querySelectorAll('.worlds-content button')].find(x=>x.textContent==='Join / Open channel');assert.ok(button);button.click();await f.flush();assert.ok(f.calls.some(c=>c.action==='community.room.join'&&c.input.id==='r1'));assert.equal(f.opened.length,0,'World message view remains inside Worlds');assert.ok(f.doc.querySelector('.worlds-thread'));const openChats=[...f.doc.querySelectorAll('.worlds-thread button')].find(x=>x.textContent==='Open in Chats');openChats.click();await f.flush();assert.deepEqual(f.opened,['c1']);}finally{f.close()}
});
test('World requests are private to the authenticated account and clear on signout',async()=>{
 const f=fixture();try{f.api.onTab('group');await f.flush();f.doc.querySelector('.worlds-server').click();await f.flush();const request=[...f.doc.querySelectorAll('.worlds-content button')].find(x=>x.textContent==='Request to join');assert.ok(request);request.click();await f.flush();assert.ok(f.calls.some(c=>c.action==='community.apply'&&c.input.id==='w1'));f.setActor(null);f.api.signedOut();assert.equal(f.doc.querySelector('.worlds-servers').textContent,'');assert.equal(f.doc.querySelector('.worlds-content').textContent,'')}finally{f.close()}
});
test('Luonix shows text posts, photos and video while preserving the existing real publish RPCs',async()=>{
 const feed=await readFile('src/social-feed.js','utf8'),social=await readFile('src/social-spaces.js','utf8'),composer=await readFile('src/clip-composer.js','utf8'),css=await readFile('public/luo-social-feed.css','utf8');
 assert.match(feed,/const kinds=clipsOnly\?\['clip','post'\]/);
 assert.match(feed,/sourceMode==='public'&&item\.audience!=='public'/);
 assert.match(feed,/Luonix · videos, photos and posts/);
 assert.match(social,/\['clips','Luonix'\]/);
 assert.match(social,/feedMode='mixed'/);
 assert.match(composer,/luonix-publishing-steps/);
 assert.match(composer,/setPublishStep\('media'\)/);
 assert.match(composer,/entry\.create/);
 assert.match(composer,/entry\.publish/);
 assert.match(css,/#social\[data-social-view=clips\]>.*luo-social-tools\{display:none\}/);
});
test('Mobile Worlds navigation retains genuine app navigation and does not show the obsolete overlay',async()=>{
 const approved=await readFile('public/luo-approved.js','utf8'),polish=await readFile('public/luo-phone-polish.js','utf8'),html=await readFile('public/index.html','utf8');
 assert.match(approved,/\['Worlds','users','group'\]/);
 assert.match(polish,/document\.querySelector\('#group \.worlds-app'\)/);
 assert.match(html,/\/luo-worlds\.css/);
 assert.match(html,/\/luonix-publisher\.css/);
 assert.match(html,/title="Worlds" aria-label="Worlds"/);
});

test('Worlds group creation is mounted above mobile navigation and removes its overlay on close',async()=>{
 const {installWorlds}=await import('../src/worlds.js');
 const {JSDOM}=await import('jsdom');
 const dom=new JSDOM('<div class="app" data-screen="home" data-tab="group"><div id="group"></div><nav id="luoApprovedNav"></nav></div>',{url:'https://luo.example'});
 const w=dom.window,d=w.document;
 const api=installWorlds({win:w,db:{rpc:async()=>({data:[]})},$:id=>d.getElementById(id),getUser:()=>({id:'one'}),note:()=>{},openRoom:()=>{},refreshChats:async()=>{},getChats:()=>[]});
 try{
  api.onTab('group');await new Promise(ok=>setTimeout(ok,0));
  d.querySelector('.worlds-group-create').click();
  const overlay=d.querySelector('.worlds-modal-backdrop');
  assert.ok(overlay);assert.equal(overlay.parentElement,d.body);
  overlay.querySelector('button').click();
  assert.equal(d.querySelector('.worlds-modal-backdrop'),null);
 }finally{api.signedOut();w.close()}
});
