import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile('public/index.html','utf8');
const source=await readFile('public/luo-secondary-v4.js','utf8');
const css=await readFile('public/luo-secondary-v4.css','utf8');
function create(){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.eval(source);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,d,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
test('secondary screen system preserves existing core form ids and handlers',()=>{
 const x=create();
 try{
  const d=x.d;
  assert.ok(d.getElementById('pollForm').contains(d.getElementById('confirmPoll')));
  assert.ok(d.getElementById('scheduleForm').contains(d.getElementById('confirmSchedule')));
  assert.ok(d.getElementById('sharedFilters').contains(d.getElementById('mediaType')));
  assert.ok(d.getElementById('mediaViewer').contains(d.getElementById('mediaContent')));
  assert.equal(d.querySelectorAll('#luoPollChoiceCount').length,1);
  assert.equal(d.querySelectorAll('.luo-secondary-message-preview').length,1);
  assert.equal(d.querySelectorAll('#sharedFilters .luo-shared-v4-tabs button').length,5);
 }finally{x.close()}
});
test('shared media category chips trigger original filter change handler',()=>{
 const x=create();try{
  const d=x.d,filter=d.getElementById('mediaType');
  let called=0;filter.addEventListener('change',()=>called++);
  d.querySelector('.luo-shared-v4-tab[data-type="image/"]').click();
  assert.equal(filter.value,'image/');
  assert.equal(called,1);
  assert.equal(d.querySelector('.luo-shared-v4-tab[data-type="image/"]').getAttribute('aria-pressed'),'true');
  d.querySelector('.luo-shared-v4-tab[data-type="all"]').click();
  assert.equal(filter.value,'all');
 }finally{x.close()}
});
test('quiz correct-answer field is available only for quizzes without losing its original ID',()=>{
 const x=create();try{
  const d=x.d,k=d.getElementById('pollKind'),correct=d.getElementById('quizCorrect'),opts=d.getElementById('pollOptions');
  assert.equal(correct.disabled,true);
  k.value='quiz';k.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  assert.equal(correct.hidden,false);assert.equal(correct.disabled,false);
  opts.value='Red\nGreen\nBlue';
  opts.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(d.getElementById('luoPollChoiceCount').textContent,/3 of 8/);
  k.value='poll';k.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  assert.equal(correct.hidden,true);
 }finally{x.close()}
});
test('scheduled messages show a live local preview without changing the message input',()=>{
 const x=create();try{
  const d=x.d,area=d.getElementById('scheduledBody');
  area.value='Message for later';
  area.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.luo-secondary-preview-bubble').textContent,'Message for later');
  assert.equal(area.value,'Message for later');
 }finally{x.close()}
});
test('dynamically created comments and chat-detail sheets receive consistent accessible design',async()=>{
 const x=create();try{
  const d=x.d;
  const sheet=d.createElement('dialog');sheet.className='luo-feed-comments';sheet.setAttribute('aria-label','Comments');
  d.body.append(sheet);await new Promise(r=>setTimeout(r,15));
  assert.ok(sheet.classList.contains('luo-secondary-social-sheet'));
  assert.equal(sheet.getAttribute('aria-label'),'Comments');
  const detail=d.createElement('dialog');detail.className='luo-dm-settings';d.body.append(detail);
  await new Promise(r=>setTimeout(r,15));
  assert.ok(detail.classList.contains('luo-secondary-chat-detail'));
 }finally{x.close()}
});
test('repeated screen enhancement is idempotent; reduced motion and safe areas exist',()=>{
 const x=create();try{
  x.w.LuoSecondaryV4.refresh();x.w.LuoSecondaryV4.refresh();
  assert.equal(x.d.querySelectorAll('.luo-shared-v4-tabs').length,1);
  assert.equal(x.d.querySelectorAll('.luo-secondary-context').length,2);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/#personDialog \.person-hero/);
  assert.match(css,/\.luo-feed-comments\[open\]/);
  assert.match(html,/\/luo-secondary-v4\.css/);
  assert.match(html,/\/luo-secondary-v4\.js/);
 }finally{x.close()}
});
