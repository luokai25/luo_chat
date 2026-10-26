import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile('public/index.html','utf8');
const controller=await readFile('public/luo-skeleton-v4.js','utf8');
const css=await readFile('public/luo-skeleton-v4.css','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,timeout=1200){
 const end=Date.now()+timeout;
 while(Date.now()<end){if(check())return;await sleep(20);}
 assert.ok(check(),'Expected skeleton transition did not appear within the bounded timeout');
}
function ready(){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,app=d.querySelector('.app');
 app.dataset.screen='home';app.dataset.tab='chats';
 w.eval(controller);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,d,app,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
const add=(doc,tag,cls,text)=>{
 const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;doc.body.append(node);return node;
};
test('inbox skeleton fits real 78px rows/53px avatars, avoids brief loading flashes, and vanishes after success',async()=>{
 const x=ready();try{
  const host=x.d.getElementById('chatlist');host.innerHTML='<div class="empty">Loading conversations…</div>';
  await sleep(60);
  assert.equal(host.querySelector('.luo-skeleton-stage'),null,'Do not flash a ghost screen for fast requests');
  assert.equal(host.getAttribute('aria-busy'),'true');
  await sleep(150);
  const stage=host.querySelector('.luo-skeleton-stage');assert.ok(stage);
  assert.equal(stage.dataset.kind,'chat');
  assert.equal(stage.querySelectorAll('.sk-chat-row').length,4);
  assert.equal(stage.querySelectorAll('.sk-avatar').length,4);
  assert.equal(stage.getAttribute('aria-hidden'),'true');
  host.replaceChildren(Object.assign(x.d.createElement('article'),{className:'chatrow'}));
  await sleep(205);
  assert.equal(host.querySelector('.luo-skeleton-stage'),null);
  assert.equal(host.hasAttribute('aria-busy'),false);
  assert.equal(host.querySelectorAll('.chatrow').length,1);
 }finally{x.close()}
});
test('real request events are versioned, stale completions cannot dismiss a newer inbox skeleton',async()=>{
 const x=ready();try{
  const host=x.d.getElementById('chatlist');host.replaceChildren();
  const event=(id,pending)=>x.w.dispatchEvent(new x.w.CustomEvent('luo:loading-state',{detail:{key:'inbox',id,pending}}));
  event(1,true);await until(()=>host.querySelector('.sk-chat-row'));
  assert.ok(host.querySelector('.sk-chat-row'));
  event(2,true);event(1,false);
  await sleep(60);
  assert.equal(host.getAttribute('aria-busy'),'true');
  assert.ok(host.querySelector('.sk-chat-row'));
  event(2,false);await until(()=>!host.querySelector('.luo-skeleton-stage'));
  assert.equal(host.querySelector('.luo-skeleton-stage'),null);
  assert.equal(host.hasAttribute('aria-busy'),false);
 }finally{x.close()}
});
test('native Stories rail keeps My Status first and reserves actual 220px horizontal status cards',async()=>{
 const x=ready();try{
  x.w.LuoUpdatesV2={active:()=>true};
  const rail=x.d.createElement('div');rail.id='luoUpdatesV2Rail';
  rail.append(Object.assign(x.d.createElement('button'),{className:'luo-status-v2-tile luo-status-v2-my'}));
  x.d.getElementById('chats').append(rail);
  x.d.getElementById('storyFeedStatus').textContent='Loading stories…';
  await sleep(175);
  assert.equal(rail.firstElementChild.classList.contains('luo-status-v2-my'),true);
  assert.equal(rail.querySelector('.luo-skeleton-stage').dataset.kind,'status');
  assert.equal(rail.querySelectorAll('.sk-status-card').length,3);
  rail.append(Object.assign(x.d.createElement('button'),{className:'luo-status-v2-tile'}));
  x.d.getElementById('storyFeedStatus').textContent='Only stories shared with you are shown.';
  await sleep(220);
  assert.equal(rail.querySelectorAll('.luo-skeleton-stage').length,0);
 }finally{x.close()}
});
test('Instagram-style direct message skeletons alternate bubble sides and preserve room content',async()=>{
 const x=ready();try{
  x.app.dataset.screen='room';
  const host=x.d.getElementById('messages');
  host.innerHTML='<div class="empty">Loading messages…</div>';
  await sleep(175);
  const stage=host.querySelector('.luo-skeleton-stage');
  assert.ok(stage);assert.equal(stage.dataset.kind,'message');
  assert.equal(stage.querySelectorAll('.sk-message').length,5);
  assert.equal(stage.querySelectorAll('.sk-own').length,3);
  assert.equal(stage.querySelectorAll('.sk-theirs').length,2);
  host.replaceChildren(Object.assign(x.d.createElement('article'),{className:'bubble'}));
  await sleep(210);
  assert.equal(host.querySelectorAll('.bubble').length,1);
  assert.equal(host.querySelector('.luo-skeleton-stage'),null);
 }finally{x.close()}
});
test('Luonix reel skeleton uses full-height frame and feed cards use true 4:5 media aspect',async()=>{
 const x=ready();try{
  x.app.dataset.tab='social';
  let wrapper=add(x.d,'div','luo-feed-reels');
  const list=x.d.createElement('div');list.className='luo-feed-list';wrapper.append(list);
  const feedback=x.d.createElement('p');feedback.className='luo-feed-feedback';feedback.textContent='Finding your next moment…';wrapper.append(feedback);
  await sleep(175);
  assert.equal(list.querySelector('.luo-skeleton-stage')?.dataset.kind,'reel');
  assert.equal(list.querySelectorAll('.sk-reel-card').length,1);
  feedback.textContent='';await sleep(220);
  assert.equal(list.querySelector('.luo-skeleton-stage'),null);
  wrapper.classList.remove('luo-feed-reels');feedback.textContent='Finding your next moment…';
  await sleep(175);
  assert.equal(list.querySelector('.luo-skeleton-stage')?.dataset.kind,'post');
  assert.equal(list.querySelectorAll('.sk-post-card').length,2);
 }finally{x.close()}
});
test('Worlds skeleton switches from discovery cards to compact 43px channel rows',async()=>{
 const x=ready();try{
  x.app.dataset.tab='group';
  const status=add(x.d,'p','worlds-status','Loading Worlds…');
  const content=add(x.d,'section','worlds-content');
  const channels=add(x.d,'div','worlds-channels');
  await sleep(175);
  assert.equal(content.querySelectorAll('.sk-world-row').length,3);
  status.textContent='Loading channels…';
  await sleep(215);
  assert.equal(content.querySelector('.luo-skeleton-stage'),null);
  await sleep(160);
  assert.equal(channels.querySelectorAll('.sk-channel-row').length,5);
  status.textContent='Permission denied';
  await sleep(220);
  assert.equal(channels.querySelector('.luo-skeleton-stage'),null);
  assert.equal(status.textContent,'Permission denied');
 }finally{x.close()}
});
test('private profile loading and comment loading never invent user content',async()=>{
 const x=ready();try{
  const dialog=add(x.d,'dialog','');dialog.id='personDialog';dialog.setAttribute('open','');
  const status=x.d.createElement('p');status.id='personStatus';status.textContent='Loading profile…';
  const content=x.d.createElement('div');content.id='personBody';
  dialog.append(status,content);
  await sleep(170);
  assert.ok(content.querySelector('.sk-profile-card'));
  assert.equal(content.querySelectorAll('h3,button,article').length,0);
  status.textContent='This profile is unavailable.';
  await sleep(225);
  assert.equal(content.querySelector('.luo-skeleton-stage'),null);
  const comments=add(x.d,'dialog','luo-feed-comments');comments.setAttribute('open','');
  comments.innerHTML='<div class="luo-feed-comment-list"></div><p class="luo-feed-feedback">Loading comments…</p>';
  await sleep(170);
  assert.equal(comments.querySelectorAll('.sk-comment-row').length,4);
  comments.querySelector('.luo-feed-feedback').textContent='No comments yet';
  await sleep(225);
  assert.equal(comments.querySelectorAll('.sk-comment-row').length,0);
 }finally{x.close()}
});
test('fast failures do not shimmer, and sign-out tears down placeholders and all timers',async()=>{
 const x=ready();try{
  const host=x.d.getElementById('chatlist');host.innerHTML='<div class="empty">Loading conversations…</div>';
  await sleep(30);host.innerHTML='<div class="empty">Could not load chats.</div>';
  await sleep(170);
  assert.equal(host.querySelector('.luo-skeleton-stage'),null);
  host.innerHTML='<div class="empty">Loading conversations…</div>';
  await sleep(160);assert.ok(host.querySelector('.sk-chat-row'));
  x.app.dataset.screen='auth';await sleep(40);
  assert.equal(x.d.querySelectorAll('.luo-skeleton-stage').length,0);
  assert.equal(x.d.querySelectorAll('.luo-skeleton-active').length,0);
 }finally{x.close()}
});
test('measured CSS matches production rows, cards, media frames and accessibility limits',()=>{
 const checks=[
  [/\.sk-chat-row\{[^}]*min-height:78px/, '78px inbox row'],
  [/\.sk-avatar\{[^}]*width:53px[^}]*height:53px/,'53px inbox avatar'],
  [/\.sk-status-card\{[^}]*height:220px/,'220px story'],
  [/\.sk-status-card\{[^}]*clamp\(116px,31vw,153px\)/,'responsive status width'],
  [/\.sk-feed-avatar\{[^}]*width:39px/,'39px feed avatar'],
  [/\.sk-post-media\{[^}]*aspect-ratio:4\/5/,'4:5 feed media'],
  [/\.sk-channel-row\{[^}]*min-height:43px/,'43px channel'],
  [/\.sk-world-avatar\{[^}]*width:45px/,'45px Worlds icon'],
  [/\.sk-profile-avatar\{[^}]*width:99px/,'99px profile avatar'],
  [/\.sk-reel-card\{[^}]*min-height:clamp\(360px,calc\(100dvh - 210px\),760px\)/,'full reel'],
  [/@media\(prefers-reduced-motion:reduce\)/,'reduced motion'],
  [/\.luo-skeleton-stage\.luo-skeleton-v4\[data-kind="status"\]\{order:1/,'my status remains first']
 ];
 for(const [regex,label] of checks)assert.match(css,regex,label);
 assert.ok(html.includes('/luo-skeleton-v4.js'));
 assert.ok(html.includes('/luo-skeleton-v4.css'));
});

test('shared media and global search have genuine request-shaped placeholders, not fake results',async()=>{
 const x=ready();try{
  const dialog=x.d.getElementById('sharedDialog');
  const shared=x.d.getElementById('sharedList');
  dialog.setAttribute('open','');shared.innerHTML='<div class="empty">Loading shared media…</div>';
  await until(()=>shared.querySelectorAll('.sk-shared-card').length===4);
  assert.equal(shared.querySelector('.luo-skeleton-stage')?.dataset.kind,'shared');
  shared.replaceChildren(Object.assign(x.d.createElement('div'),{className:'shared-item'}));
  await until(()=>!shared.querySelector('.luo-skeleton-stage'));
  assert.equal(shared.getAttribute('aria-busy'),null);
  const search=x.d.getElementById('globalSearchResults');
  search.textContent='Searching messages…';await until(()=>search.querySelectorAll('.sk-search-row').length===3);
  assert.equal(search.querySelector('.luo-skeleton-stage')?.dataset.kind,'search');
  search.replaceChildren(Object.assign(x.d.createElement('article'),{className:'search-result'}));
  await until(()=>!search.querySelector('.luo-skeleton-stage'));
  assert.equal(search.querySelectorAll('.search-result').length,1);
 }finally{x.close()}
});
test('loaders for secondary surfaces do not appear on idle, errors, or after signout',async()=>{
 const x=ready();try{
  const dialog=x.d.getElementById('sharedDialog');
  const shared=x.d.getElementById('sharedList');
  dialog.setAttribute('open','');shared.textContent='No media yet.';
  const search=x.d.getElementById('globalSearchResults');
  search.textContent='Nothing found.';
  await sleep(180);
  assert.equal(shared.querySelector('.luo-skeleton-stage'),null);
  assert.equal(search.querySelector('.luo-skeleton-stage'),null);
  search.textContent='Searching messages…';
  await until(()=>search.querySelector('.sk-search-row'));
  x.app.dataset.screen='auth';
  await until(()=>!search.querySelector('.luo-skeleton-stage'));
 }finally{x.close()}
});
