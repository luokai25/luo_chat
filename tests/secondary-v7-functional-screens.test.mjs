import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile('public/index.html','utf8');
const source=await readFile('public/luo-secondary-v7.js','utf8');
const stylesheet=await readFile('public/luo-secondary-v7.css','utf8');
function create(){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.eval(source);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,d,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
const tick=()=>new Promise(done=>setTimeout(done,25));
test('keyboard shortcut panel filters actual provided shortcuts, preserving original labels',()=>{
 const x=create();try{
  const d=x.d,dialog=d.getElementById('shortcutDialog'),search=d.querySelector('.luo-v7-shortcut-search');
  assert.equal(dialog.dataset.luoV7,'1');
  const count=d.querySelectorAll('.shortcut-list > div').length;
  assert.ok(count>=5);search.value='Escape';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  const visible=[...d.querySelectorAll('.shortcut-list > div')].filter(n=>!n.hidden);
  assert.equal(visible.length,1);assert.match(visible[0].textContent,/Esc/);
  search.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(search.value,'');
  assert.equal([...d.querySelectorAll('.shortcut-list > div')].filter(n=>!n.hidden).length,count);
  search.value='';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal([...d.querySelectorAll('.shortcut-list > div')].filter(n=>!n.hidden).length,count);
 }finally{x.close()}
});
test('attachment picker enhances only the actual action buttons and respects Escape',async()=>{
 const x=create();try{
  const d=x.d,attach=d.getElementById('attach'),sheet=d.createElement('div');
  sheet.id='luoDmAttachSheet';
  sheet.append(Object.assign(d.createElement('button'),{textContent:'Photo or video'}),
               Object.assign(d.createElement('button'),{textContent:'Camera'}));
  d.body.append(sheet);await tick();
  assert.equal(sheet.dataset.luoV7,'1');
  assert.equal(sheet.querySelectorAll('.luo-v7-attachment-action').length,2);
  assert.equal(sheet.querySelectorAll('.luo-v7-attachment-glyph[aria-hidden="true"]').length,2);
  assert.equal(sheet.querySelectorAll('.luo-v7-attachment-action')[0].textContent.trim().endsWith('Photo or video'),true);
  const file=d.getElementById('mediaFile'),note=sheet.querySelector('.luo-v7-attachment-note');
  Object.defineProperty(file,'files',{configurable:true,value:[new x.w.File(['abc'],'tiny.txt',{type:'text/plain'})]});
  file.dispatchEvent(new x.w.Event('change'));
  assert.ok(note.textContent.includes('tiny.txt') && note.textContent.includes('KB'));
  Object.defineProperty(file,'files',{configurable:true,value:[new x.w.File(['a'],'one.txt'),new x.w.File(['b'],'two.txt')]});
  file.dispatchEvent(new x.w.Event('change'));
  assert.match(note.textContent,/2 files selected.*total/);
  Object.defineProperty(file,'files',{configurable:true,value:[]});
  file.dispatchEvent(new x.w.Event('change'));
  assert.match(note.textContent,/Uploads are limited/);
  sheet.hidden=false;attach.setAttribute('aria-expanded','true');
  sheet.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(sheet.hidden,true);assert.equal(attach.getAttribute('aria-expanded'),'false');
 }finally{x.close()}
});
test('Worlds modal validates actual username formatting and calculates distinct invitees',async()=>{
 const x=create();try{
  const d=x.d,form=d.createElement('form');form.className='worlds-modal';
  form.innerHTML='<h2>New group conversation</h2><label class="worlds-field">Group name<input></label><label class="worlds-field">Member usernames<textarea></textarea></label><div class="worlds-modal-buttons"><button type="submit">Create group</button></div>';
  d.body.append(form);await tick();
  const name=form.querySelector('input'),users=form.querySelector('textarea'),feedback=form.querySelector('.luo-v7-worlds-feedback');
  assert.equal(form.dataset.luoV7,'1');
  name.value='Test group';name.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  users.value='qa_friend,another_name,qa_friend';users.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(feedback.textContent,/2 unique invitees/);assert.equal(feedback.dataset.valid,'true');
  users.value='bad name';users.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(feedback.textContent,/1 username/);assert.equal(feedback.dataset.valid,'false');
  assert.equal(form.querySelector('button').type,'submit');
 }finally{x.close()}
});
test('Status viewer preserves existing native reply submit flow while counting typed characters',async()=>{
 const x=create();try{
  const d=x.d,viewer=d.createElement('dialog');viewer.id='luoUpdatesV2Viewer';
  const prev=d.createElement('button');prev.className='luo-status-v2-hit-back';
  const next=d.createElement('button');next.className='luo-status-v2-hit-next';
  const reply=d.createElement('form');reply.className='luo-status-v2-reply';
  const input=d.createElement('input');input.maxLength=10000;
  const send=d.createElement('button');send.type='submit';
  reply.append(input,send);viewer.append(prev,next,reply);d.body.append(viewer);
  await tick();
  assert.equal(viewer.dataset.luoV7,'1');
  input.value='Hi';input.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(viewer.querySelector('.luo-v7-status-count').textContent,/2 \/ 10,000/);
  input.removeAttribute('maxlength');input.value='Hello';input.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(viewer.querySelector('.luo-v7-status-count').textContent,'5 characters');
  input.maxLength=10000;input.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(send.type,'submit');
  assert.equal(prev.getAttribute('aria-label'),'View previous status');
  viewer.dispatchEvent(new x.w.Event('close'));assert.equal(input.value,'');
 }finally{x.close()}
});
test('V7 design retains actual security and accessibility rules',()=>{
 assert.match(html,/href="\/luo-secondary-v7\.css"/);
 assert.match(html,/src="\/luo-secondary-v7\.js"/);
 assert.match(stylesheet,/prefers-reduced-motion:reduce/);
 assert.match(source,/worlds-modal/);
 assert.match(source,/luoUpdatesV2Viewer/);
 assert.doesNotMatch(source,/supabase|subscription|billing\/checkout/);
});
