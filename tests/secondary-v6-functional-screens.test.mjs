import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile('public/index.html','utf8');
const v6=await readFile('public/luo-secondary-v6.js','utf8');
const css=await readFile('public/luo-secondary-v6.css','utf8');
function create(){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;w.eval(v6);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,d,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
const tick=()=>new Promise(r=>setTimeout(r,20));
test('four true V6 secondary surfaces are mounted without replacing server-backed actions',()=>{
 const x=create();try{
  for(const id of ['storyForm','messageActionDialog','workspaceDialog','avatarDialog'])
   assert.ok(x.d.getElementById(id).dataset.luoV6==='1',id);
  for(const id of ['publishStory','submitMessageAction','closeWorkspace','closeAvatar'])
   assert.ok(x.d.getElementById(id),id);
  assert.match(html,/href="\/luo-secondary-v6.css"/);assert.match(html,/src="\/luo-secondary-v6.js"/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 }finally{x.close()}
});
test('story composer explains private audience, selected attachment and real 24h expiry',()=>{
 const x=create();try{
  const d=x.d;
  const body=d.getElementById('storyBody');body.value='Hello private circle';
  body.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  const audience=d.getElementById('storyAudience');
  audience.value='friend_one,friend_two,friend_one';audience.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(d.querySelector('.luo-v6-story-text').textContent,/Hello private circle/);
  assert.match(d.querySelector('.luo-v6-story-privacy').textContent,/2 accounts selected/);
  assert.match(d.querySelector('.luo-v6-preview-header').textContent,/24 hours/);
  audience.value='';audience.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(d.querySelector('.luo-v6-story-privacy').textContent,/Only you/);
  assert.equal(body.value,'Hello private circle');
 }finally{x.close()}
});
test('story preview keeps the same selected image URL when only the story text changes',()=>{
 const x=create();try{
  const d=x.d,media=d.getElementById('storyMedia'),body=d.getElementById('storyBody');
  let created=0,revoked=0;
  x.w.URL.createObjectURL=()=>{created++;return 'blob:luo-preview-'+created};
  x.w.URL.revokeObjectURL=()=>{revoked++};
  const file=new x.w.File(['image'],'preview.png',{type:'image/png'});
  Object.defineProperty(media,'files',{configurable:true,value:[file]});
  media.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  assert.equal(created,1);
  body.value='Updated caption';body.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(created,1,'caption changes must not allocate new media previews');
  assert.equal(revoked,0);
  x.d.querySelector('.luo-v6-story').dispatchEvent(new x.w.Event('close'));
  assert.equal(revoked,1,'closing story preview frees object URL');
 }finally{x.close()}
});
test('message action review renders real edit fields and never submits changes automatically',async()=>{
 const x=create();try{
  const d=x.d,fields=d.getElementById('messageActionFields');
  const editor=d.createElement('textarea');editor.maxLength=300;fields.append(editor);
  editor.value='edited message text';editor.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  await tick();
  assert.equal(d.querySelector('.luo-v6-action-receipt p').textContent,'edited message text');
  assert.match(d.querySelector('.luo-v6-action-receipt small').textContent,/300 characters/);
  assert.equal(d.getElementById('submitMessageAction').type,'submit');
 }finally{x.close()}
});
test('workspace action search forwards direct clicks to real enabled tools',async()=>{
 const x=create();try{
  const d=x.d,body=d.getElementById('workspaceBody');
  const btn=d.createElement('button');btn.textContent='Open shared media';
  let clicked=0;btn.addEventListener('click',()=>clicked++);body.append(btn);
  const search=d.querySelector('.luo-v6-tool-search');search.value='shared';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  await tick();const hit=d.querySelector('.luo-v6-tool-hit');assert.ok(hit);
  hit.click();assert.equal(clicked,1);assert.ok(body.contains(btn));
 }finally{x.close()}
});
test('avatar viewer zoom changes only local image rendering and resets on close',()=>{
 const x=create();try{
  const d=x.d,img=d.getElementById('avatarFull'),controls=d.querySelector('.luo-v6-avatar-controls');
  controls.querySelectorAll('button')[1].click();
  assert.equal(img.style.transform,'scale(1.25)');
  d.getElementById('avatarDialog').dispatchEvent(new x.w.Event('close'));
  assert.equal(img.style.transform,'');
 }finally{x.close()}
});
