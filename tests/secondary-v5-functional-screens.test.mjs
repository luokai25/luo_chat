import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile('public/index.html','utf8');
const v4=await readFile('public/luo-secondary-v4.js','utf8');
const v5=await readFile('public/luo-secondary-v5.js','utf8');
const css=await readFile('public/luo-secondary-v5.css','utf8');
function setup(){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.eval(v4);w.eval(v5);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,d,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
const wait=()=>new Promise(r=>setTimeout(r,15));
test('six V5 secondary surfaces are mounted without replacing native action controls',()=>{
 const x=setup();try{
  for(const id of ['sharedDialog','pollDialog','scheduleDialog','mediaViewer','personalizeDialog','deleteDialog'])
   assert.equal(x.d.getElementById(id).dataset.luoV5,'1',id);
  for(const id of ['confirmPoll','confirmSchedule','closeShared','closeMediaViewer','confirmDelete','personalizeForm'])
   assert.ok(x.d.getElementById(id),id);
  assert.match(html,/href="\/luo-secondary-v5.css"/);
  assert.match(html,/src="\/luo-secondary-v5.js"/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 }finally{x.close()}
});
test('quiz preview mirrors actual form fields and selected correct answer',()=>{
 const x=setup();try{
  const d=x.d,k=d.getElementById('pollKind'),q=d.getElementById('pollQuestion'),
   opts=d.getElementById('pollOptions'),c=d.getElementById('quizCorrect');
  k.value='quiz';k.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  q.value='Choose the right answer?';q.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  opts.value='Earth\nMars\nVenus';opts.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.luo-v5-poll-question').textContent,'Choose the right answer?');
  assert.equal(d.querySelectorAll('.luo-v5-poll-choice').length,3);
  d.querySelectorAll('.luo-v5-poll-choice')[1].click();
  assert.equal(c.value,'2');assert.equal(d.querySelectorAll('.luo-v5-poll-choice')[1].getAttribute('aria-pressed'),'true');
  assert.equal(opts.value,'Earth\nMars\nVenus');
 }finally{x.close()}
});
test('scheduled send receipt reflects real local date and warns about past times',()=>{
 const x=setup();try{
  const d=x.d,t=d.getElementById('scheduledTime');
  t.value='2001-01-01T12:00';t.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.luo-v5-time-receipt').dataset.state,'invalid');
  assert.match(d.querySelector('.luo-v5-time-note').textContent,/past/);
  t.value='2090-11-25T18:30';t.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  assert.equal(d.querySelector('.luo-v5-time-receipt').dataset.state,'ready');
 }finally{x.close()}
});
test('shared media counts real authorized results without fabricated placeholders',async()=>{
 const x=setup();try{
  const d=x.d,dialog=d.getElementById('sharedDialog'),list=d.getElementById('sharedList');
  dialog.setAttribute('open','');
  list.replaceChildren(Object.assign(d.createElement('article'),{className:'media-card'}));
  await wait();assert.match(d.querySelector('.luo-v5-result-count').textContent,/1 loaded item/);
  list.replaceChildren();await wait();assert.match(d.querySelector('.luo-v5-result-count').textContent,/No files/);
 }finally{x.close()}
});
test('media zoom affects only the displayed photo and resets on close',async()=>{
 const x=setup();try{
  const d=x.d,dialog=d.getElementById('mediaViewer'),content=d.getElementById('mediaContent');
  dialog.setAttribute('open','');content.append(d.createElement('img'));
  await wait();const zoom=d.querySelector('.luo-v5-media-zoom'),img=content.querySelector('img');
  assert.equal(zoom.hidden,false);zoom.querySelector('[aria-label="Zoom image in"]').click();
  assert.equal(img.style.transform,'scale(1.25)');
  dialog.removeAttribute('open');dialog.dispatchEvent(new x.w.Event('close'));
  assert.equal(img.style.transform,'');
 }finally{x.close()}
});
test('theme preview and delete confirmation change only local UI, never submit a backend action',()=>{
 const x=setup();try{
  const d=x.d,accent=d.getElementById('chatAccent'),nickname=d.getElementById('chatNickname');
  nickname.value='Work Circle';nickname.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  accent.value='#abcdef';accent.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(d.querySelector('.luo-v5-theme-person').textContent,/Work Circle/);
  assert.match(d.querySelector('.luo-v5-theme-preview').getAttribute('style'),/#abcdef/);
  const phrase=d.getElementById('deleteConfirmation'),pass=d.getElementById('deletePassword');
  pass.value='secret';pass.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  phrase.value='DELETE MY ACCOUNT';phrase.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.luo-v5-delete-gate').dataset.complete,'true');
  phrase.value='delete my account';phrase.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.luo-v5-delete-gate').dataset.complete,'false');
 }finally{x.close()}
});
