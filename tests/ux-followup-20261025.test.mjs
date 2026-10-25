import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {mountSocialFeed} from '../src/social-feed.js';
const tick=()=>new Promise(r=>setImmediate(r));

test('Social entry opens Clips immediately, never defaults to legacy Friends page',async()=>{
 const s=await readFile('src/social-spaces.js','utf8');
 assert.match(s,/let section='clips'/);
 assert.match(s,/const socialTab=btn\('Social',\(\)=>\{section='clips'/);
 assert.match(s,/feedMode='public'/);
 const feed=await readFile('src/social-feed.js','utf8');
 assert.match(feed,/\['explore','Explore'\]/);
 assert.match(feed,/\['public','Public'\]/);
 assert.match(feed,/\['friends','Friends'\]/);
 assert.doesNotMatch(feed,/Back to Social/);
});

test('An owned published video has management options only in three dots, and saves title/caption',async()=>{
 const dom=new JSDOM('<div id="out"></div>',{url:'https://luo.example/',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.HTMLMediaElement.prototype.pause=function(){};
 w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};
 w.HTMLMediaElement.prototype.load=function(){};
 w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 const clip={id:'11111111-1111-4111-8111-111111111111',kind:'clip',owner_id:'me',published:true,audience:'public',title:'Old',body:'Old caption',created_at:'2026-10-25T10:00:00Z',author:{id:'me',username:'creator',display_name:'Creator'},media:[],mine:{}};
 const db={rpc:async(name,arg)=>{calls.push({name,arg});if(name==='luo_space'&&arg.action==='feed')return{data:arg.input.kind==='clip'?[clip]:[]};if(name==='luo_clip_edit')return{data:{id:clip.id,updated:true}};return{data:[]}},storage:{from:()=>({createSignedUrl:async()=>({error:{message:'unavailable'}})})}};
 const stop=mountSocialFeed({win:w,db,getUser:()=>({id:'me'}),getChats:()=>[],output:d.querySelector('#out'),note:()=>{},mode:'public',clipsOnly:true});
 try{
  await tick();await tick();
  assert.equal(d.querySelector('.luo-feed-card')?.dataset.entryId,clip.id);
  assert.equal([...d.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Delete post'),false);
  const more=[...d.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='More options');assert.ok(more);
  more.click();
  assert.ok(d.querySelector('.luo-clip-owner-edit'));
  assert.ok([...d.querySelectorAll('.luo-feed-comments button')].some(b=>b.textContent.includes('Delete video')));
  d.querySelector('input[aria-label="Edit clip title"]').value='New clip';
  d.querySelector('textarea[aria-label="Edit clip caption"]').value='New caption';
  d.querySelector('.luo-clip-owner-edit').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await tick();await tick();
  const e=calls.find(x=>x.name==='luo_clip_edit');assert.ok(e);
  assert.deepEqual(e.arg,{target_clip:clip.id,new_title:'New clip',new_caption:'New caption'});
  assert.equal(d.querySelector('.luo-feed-caption h3').textContent,'New clip');
 }finally{stop();w.close()}
});

test('Cookie choice closes both popup and floating button and persists without 180-day re-prompt',async()=>{
 const src=await readFile('public/cookie-consent.js','utf8');
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://luo.example/',runScripts:'outside-only'});
 const w=dom.window;
 try{
  w.eval(src);assert.equal(w.document.querySelector('.luo-consent').hidden,false);
  [...w.document.querySelectorAll('.luo-consent-actions button')][0].click();
  assert.equal(w.document.querySelector('.luo-consent').hidden,true);
  assert.equal(w.document.querySelector('.luo-cookie-settings').hidden,true);
  assert.equal(w.luoDiagnosticsAllowed(),false);
  const saved=JSON.parse(w.localStorage.getItem('luo-consent-v1'));assert.equal(saved.diagnostics,false);
  const next=new JSDOM('<!doctype html><body></body>',{url:'https://luo.example/',runScripts:'outside-only'});
  try{next.window.localStorage.setItem('luo-consent-v1',JSON.stringify({...saved,at:1}));next.window.eval(src);
   assert.equal(next.window.document.querySelector('.luo-consent').hidden,true);
   assert.equal(next.window.document.querySelector('.luo-cookie-settings').hidden,true);
  }finally{next.window.close()}
 }finally{w.close()}
});

test('Call mirror only affects front-facing local preview, not remote or screen share',async()=>{
 const css=await readFile('public/luo-call-quality.css','utf8');
 const call=await readFile('src/calls.js','utf8');
 const experience=await readFile('src/call-experience.js','utf8');
 assert.match(css,/#callLocal\{transform:translate\(var\(--call-pip-x,0px\),var\(--call-pip-y,0px\)\) scaleX\(-1\)!important\}/);
 assert.match(css,/:not\(\.luo-screen-sharing\)/);
 assert.match(css,/#callRemote\{transform:none!important\}/);
 assert.match(call,/getFacing:\(\)=>facing/);
 assert.match(experience,/syncPreviewFacing/);
});

test('Staging-tested published clip edit migration enforces identity, ownership, safe fields and revision history',async()=>{
 const sql=await readFile('supabase/migrations/20261025190200_owner_clip_caption_edit.sql','utf8');
 for(const expected of [/auth.uid\(\)/,/owner_id=actor/,/kind='clip'/,/published=true/,/char_length\(new_title\)>160/,/char_length\(new_caption\)>4000/,/clip_caption_revisions/,/grant execute on function public.luo_clip_edit\(uuid,text,text\) to authenticated/])assert.match(sql,expected);
 assert.doesNotMatch(sql,/update\s+luo_internal\.space_entries\s+set\s+media/i);
});
