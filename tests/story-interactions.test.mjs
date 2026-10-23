import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';
import {installStoryPrompts,normalizeStoryPrompt} from '../src/story-interactions.js';

function setup({missingBackend=false,delayed=false}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><form id="storyForm"><label for="storyAudience">Audience</label><textarea id="storyAudience"></textarea></form><div id="feed"></div></body></html>',{url:'https://luo-chat-luokai25.vercel.app/',pretendToBeVisual:true});
 const win=dom.window;win.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';
 let user={id:'owner-1'},release=null;
 let state={story_id:'story-1',kind:'quiz',question:'Do you know the answer?',choices:['Yes','No','Maybe'],correct_index:null,my_choice:null,is_owner:false,counts:null,total_votes:null};
 const calls=[],notices=[],pending=[];
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(missingBackend)return {error:{code:'PGRST202',message:'function does not exist'}};
  if(delayed&&name==='get_chat_story_prompt'&&args.target_story_id==='story-1'){
   return new Promise(resolve=>{release=()=>resolve({data:state})});
  }
  if(name==='get_chat_story_prompt')return {data:args.target_story_id==='story-1'?state:null};
  if(name==='vote_chat_story_prompt'){
   state={...state,my_choice:args.selected_index,correct_index:1,counts:[0,1,0],total_votes:1};return {data:state}
  }
  if(name==='create_chat_story_prompt')return {data:true};
  return {error:{message:'Unexpected RPC '+name}};
 }};
 const api=installStoryPrompts({win,db,getUser:()=>user,note:s=>notices.push(s)});
 const tick=()=>new Promise(r=>setTimeout(r,0));
 return {api,win,dom,db,calls,notices,release:()=>release?.(),setUser:u=>{user=u},setPrompt:p=>{state=p},tick,feed:win.document.getElementById('feed')};
}
test('normalization enforces two to four distinct choices, privacy-safe quiz answers and lengths',()=>{
 assert.deepEqual(normalizeStoryPrompt({kind:'none'}),null);
 assert.deepEqual(normalizeStoryPrompt({kind:'poll',question:' Which game? ',choices:[' A ',' B ', '', '']}),{kind:'poll',question:'Which game?',choices:['A','B'],correctIndex:null});
 assert.deepEqual(normalizeStoryPrompt({kind:'quiz',question:'Which answer?',choices:['One','Two'],correctIndex:1}),{kind:'quiz',question:'Which answer?',choices:['One','Two'],correctIndex:1});
 assert.throws(()=>normalizeStoryPrompt({kind:'poll',question:'Short?',choices:['One','one']}),/different/);
 assert.throws(()=>normalizeStoryPrompt({kind:'quiz',question:'Quiz?',choices:['yes','no']}),/correct quiz/);
 assert.throws(()=>normalizeStoryPrompt({kind:'poll',question:'?',choices:['x','y']}),/3 and 160/);
 assert.throws(()=>normalizeStoryPrompt({kind:'poll',question:'Enough?',choices:['single']}),/two to four/);
});
test('new story sticker is shown only after backend support and has valid publish payload',async()=>{
 const h=setup();
 try{
  assert.equal(h.api.fields.field.id,'storyInteractiveSticker');
  assert.equal(await h.api.ready(),true);
  h.api.fields.kind.value='quiz';h.api.fields.kind.dispatchEvent(new h.win.Event('change'));
  h.api.fields.question.value='Which color?';
  h.api.fields.choices[0].value='Gold';h.api.fields.choices[1].value='Black';
  h.api.fields.correct.value='0';
  const spec=h.api.validate();
  assert.equal(spec.correctIndex,0);
  await h.api.publish('story-1',spec);
  const call=h.calls.find(x=>x.name==='create_chat_story_prompt');
  assert.equal(call.args.target_story_id,'story-1');
  assert.equal(call.args.prompt_kind,'quiz');
  assert.equal(call.args.answer_index,0);
  h.api.reset();
  assert.equal(h.api.validate(),null);
 }finally{h.dom.window.close()}
});
test('older backend disables interactive publishing but does not prevent normal private Stories',async()=>{
 const h=setup({missingBackend:true});
 try{
  assert.equal(await h.api.ready(),false);
  assert.equal(h.api.fields.kind.disabled,true);
  assert.equal(h.api.validate(),null);
  assert.match(h.win.document.getElementById('storyStickerSupportStatus').textContent,/backend update/);
  await h.api.publish('story-1',null);
  assert.equal(h.calls.filter(x=>x.name==='create_chat_story_prompt').length,0);
 }finally{h.dom.window.close()}
});
test('private quiz renders accessible golden choices and reveals answer only after a saved vote',async()=>{
 const h=setup();
 try{
  await h.api.ready();
  const root=h.win.document.createElement('div');h.feed.append(root);
  await h.api.render(root,{id:'story-1'});
  assert.equal(root.querySelectorAll('button.story-option').length,3);
  assert.equal(root.querySelector('[data-correct="true"]'),null);
  assert.match(root.textContent,/Choose one answer/);
  root.querySelectorAll('button.story-option')[1].click();
  await h.tick();await h.tick();
  assert.equal(h.calls.filter(x=>x.name==='vote_chat_story_prompt').length,1);
  assert.equal(root.querySelectorAll('button.story-option:disabled').length,3);
  assert.equal(root.querySelector('[data-correct="true"]').textContent,'No');
  assert.match(root.textContent,/1 vote · 100%/);assert.match(root.textContent,/Correct! Your answer was saved/);
 }finally{h.dom.window.close()}
});
test('stale responses cannot display private content after signout or account switch',async()=>{
 const h=setup({delayed:true});
 try{
  const root=h.win.document.createElement('div');h.feed.append(root);
  const pending=h.api.render(root,{id:'story-1'});
  h.setUser({id:'another-user'});h.api.signedOut();h.release();
  await pending;
  assert.equal(root.textContent,'');
 }finally{h.dom.window.close()}
});
test('untrusted story text is never inserted as HTML',async()=>{
 const h=setup();
 try{
  h.setPrompt({story_id:'story-1',kind:'poll',question:'<img src=x onerror=alert(1)>',choices:['<script>bad()</script>','Safe'],my_choice:null,is_owner:false,counts:null});
  const root=h.win.document.createElement('div');h.feed.append(root);
  await h.api.render(root,{id:'story-1'});
  assert.equal(root.querySelector('script'),null);
  assert.equal(root.querySelector('img'),null);
  assert.match(root.textContent,/<script>bad/);
 }finally{h.dom.window.close()}
});
