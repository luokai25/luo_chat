import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createChatWallpapers,installInstagramChats} from '../src/instagram-chat.js';
import {parseLuoShare,installReelMessagePreviews} from '../src/reel-message-preview.js';

test('Luo direct messages provide ten curated interactive offline scenes with no external URLs',()=>{
 const themes=createChatWallpapers();
 assert.equal(themes.length,10);assert.equal(new Set(themes.map(x=>x.id)).size,10);assert.equal(new Set(themes.map(x=>x.name)).size,10);
 for(const theme of themes){assert.match(theme.background,/gradient/);assert.doesNotMatch(theme.background,/url\s*\(/i);}
});
test('Wallpapers are isolated by account and conversation, and clean on sign-out',()=>{
 const dom=new JSDOM('<div class="app" data-screen="room"><section id="chats"></section><section id="room"><div class="roomhead"><div class="roomtools"></div></div><div id="messages"></div></section></div>',{url:'https://luo.test'});
 const w=dom.window,d=w.document;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};let user={id:'human1'},conversation={id:'direct1',kind:'direct',person:{username:'Friend'}};
 const api=installInstagramChats({win:w,getUser:()=>user,getCurrent:()=>conversation,getChats:()=>[],openRoom:()=>{}});
 try{
  assert.equal(api.wallpaperCount,10);api.onRoom();
  d.querySelector('.luo-dm-info').click();
  assert.equal(d.querySelectorAll('.luo-dm-wallpaper').length,10);
  d.querySelector('[data-theme="7"]').click();assert.equal(d.getElementById('room').dataset.luoTheme,'7');
  assert.equal(JSON.parse(w.localStorage.getItem('luo-dm-theme-v1:human1:direct1')).theme,7);
  conversation={id:'direct2',kind:'direct',person:{username:'Other'}};api.onRoom();
  assert.equal(d.getElementById('room').dataset.luoTheme,'0');
  user={id:'human2'};api.onRoom();assert.equal(d.getElementById('room').dataset.luoTheme,'0');
  api.signedOut();assert.equal(d.getElementById('room').style.getPropertyValue('--luo-dm-wallpaper'),'');
 }finally{w.close()}
});
test('Rich shares recognize real video and written/photo references, reject arbitrary markup',()=>{
 const id='12345678-1234-4234-8234-123456789abc';
 assert.deepEqual(parseLuoShare('Luo Clip\n'+id),{kind:'clip',id});
 assert.deepEqual(parseLuoShare('Luo Post\n'+id),{kind:'post',id});
 assert.equal(parseLuoShare('Luo Post\n<script>alert(1)</script>'),null);
});
test('Rich cards check viewer-specific entry permissions, never copy signed URLs into message body',async()=>{
 const id='12345678-1234-4234-8234-123456789abc',dom=new JSDOM('<section id="messages"><div class="bubble-body">Luo Post\n'+id+'</div></section>',{url:'https://luo.test',pretendToBeVisual:true}),w=dom.window,d=w.document;
 let actor={id:'human1'},opened=null;
 const db={rpc:async()=>({data:{id,kind:'post',published:true,owner_id:'human1',author:{username:'Kai'},title:'Hello world',body:'A message in Luonix',media:[]}})};
 const dispose=installReelMessagePreviews({win:w,container:d.getElementById('messages'),getUser:()=>actor,db,openClip:x=>opened=x});
 try{for(let i=0;i<5;i++)await Promise.resolve();const card=d.querySelector('.luo-share-rich');assert.ok(card);assert.match(card.textContent,/Hello world/);assert.doesNotMatch(d.querySelector('.bubble-body').textContent,/signedUrl/);card.click();assert.equal(opened,id);actor=null;card.click();assert.equal(opened,id);}finally{dispose();w.close()}
});
test('Source only shows direct messages in Chats and keeps groups inside Worlds',async()=>{
 const app=await readFile('src/app.js','utf8'),worlds=await readFile('src/worlds.js','utf8'),social=await readFile('src/social-feed.js','utf8'),html=await readFile('public/index.html','utf8');
 assert.match(app,/chats\.filter\(c=>c\.kind!=='group'/);
 assert.match(worlds,/GROUP MESSAGES/);assert.match(worlds,/create_group_chat/);
 assert.match(social,/item\.kind==='clip'\?'Share Luonix':'Share post'/);
 assert.match(html,/\/luo-instagram-chat\.css/);
});
test('Agent developer docs are public but membership remains gated',async()=>{
 const guide=await readFile('public/agents.html','utf8'),api=JSON.parse(await readFile('public/openapi.json','utf8'));
 assert.match(guide,/currently closed/);
 assert.ok(api.paths['/api/v1/platform']);assert.ok(api.paths['/api/v1/agents/register']);
 const source=await readFile('src/server/agent-platform.js','utf8');
 assert.match(source,/agent_memberships:'not_open'/);
});
test('Workspace adds owner-only product telemetry without exposing message bodies',async()=>{
 const sql=await readFile('workspace/luo-workspace-product-telemetry.sql','utf8'),view=await readFile('workspace/index.html','utf8'),app=await readFile('workspace/app.js','utf8');
 assert.match(sql,/luo_workspace\.admin_users/);assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.doesNotMatch(sql,/SELECT\s+body\s+FROM/i);
 assert.match(view,/data-page="product"/);assert.match(app,/luo_workspace_product_insights/);
});

test('Chat details never cover an open profile or photo dialog',async()=>{
 const dom=new JSDOM('<div class="app" data-screen="room"><section id="chats"></section><section id="room"><div class="roomhead"><div class="roomtools"></div></div><div id="messages"></div></section></div><dialog id="personDialog"></dialog><dialog id="personPhotoDialog"></dialog>',{url:'https://luo.test'});
 const w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const api=installInstagramChats({win:w,getUser:()=>({id:'human1'}),getCurrent:()=>({id:'room1',kind:'direct',person:{username:'Peer'}}),getChats:()=>[],openRoom:()=>{}});
 try{
  d.getElementById('personDialog').showModal();
  d.querySelector('.luo-dm-info').click();
  assert.equal(d.querySelector('.luo-dm-settings').open,false);
  d.getElementById('personDialog').close();
  d.querySelector('.luo-dm-info').click();
  assert.equal(d.querySelector('.luo-dm-settings').open,true);
  d.getElementById('personPhotoDialog').showModal();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(d.querySelector('.luo-dm-settings').open,false);
 }finally{api.signedOut();w.close()}
});
