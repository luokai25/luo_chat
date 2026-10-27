import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {validateLuonixMedia,LUONIX_MEDIA_RULES,mountLuonixMediaPublisher} from '../src/luonix-media-publisher.js';

function harness({deferUpload=false}={}){
 const dom=new JSDOM('<main id="social"></main>',{url:'https://luo.test/',pretendToBeVisual:true});
 const win=dom.window,d=win.document,output=d.getElementById('social');
 win.URL.createObjectURL=({name})=>'blob:luo-'+name;
 const revoked=[];win.URL.revokeObjectURL=value=>revoked.push(value);
 win.confirm=()=>true;
 win.crypto.randomUUID=(()=>{let n=0;return()=>('00000000-0000-4000-8000-'+(++n).toString().padStart(12,'0'))})();
 let actor={id:'alice'},requestCount=0,resolveUpload=null;
 const calls=[],uploads=[];
 const db={rpc:async(name,params)=>{
  assert.equal(name,'luo_space');calls.push(params);
  return {data:{ok:true},error:null};
 },storage:{from:bucket=>{
  assert.equal(bucket,'luo-social');
  return {upload:async(path,file,options)=>{
   uploads.push({path,file,options});requestCount++;
   if(deferUpload)return new Promise(resolve=>resolveUpload=resolve);
   return {data:{path},error:null};
  }};
 }}};
 const actions=[];
 const composer=mountLuonixMediaPublisher({win,db,output,getUser:()=>actor,note:message=>actions.push(message),
  onPublished:()=>actions.push('published'),onCancel:()=>actions.push('cancelled'),onAdvanced:()=>actions.push('studio')});
 const input=d.querySelector('.luonix-v10-file');
 function choose(...files){
  Object.defineProperty(input,'files',{configurable:true,value:files});
  input.dispatchEvent(new win.Event('change',{bubbles:true}));
 }
 function click(selector){const button=d.querySelector(selector);assert.ok(button,selector+' exists');button.click();return button}
 return {dom,win,d,output,input,composer,db,calls,uploads,revoked,choose,click,actions,
  setActor:a=>actor=a,releaseUpload:value=>resolveUpload?.(value),getRequestCount:()=>requestCount,done:()=>dom.window.close()};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));

test('Luonix media accepts mixed supported files and protects actual post upload limits',()=>{
 const file=(name,type,size)=>({name,type,size});
 assert.deepEqual(validateLuonixMedia([file('image.jpg','image/jpeg',100),file('movie.mp4','video/mp4',100)]).length,2);
 assert.throws(()=>validateLuonixMedia(Array(7).fill(file('x.jpg','image/jpeg',10))),/no more than 6/);
 assert.throws(()=>validateLuonixMedia([file('gif.gif','image/gif',200)]),/Use JPG/);
 assert.throws(()=>validateLuonixMedia([file('bad.mp4','video/mp4',21*1048576)]),/20 MB/);
 assert.throws(()=>validateLuonixMedia([file('zero.jpg','image/jpeg',0)]),/Use JPG/);
 assert.throws(()=>validateLuonixMedia([file('a.mp4','video/mp4',12*1048576),file('b.mp4','video/mp4',11*1048576)]),/total/);
 assert.equal(LUONIX_MEDIA_RULES.maxFiles,6);
});

test('real gallery selection opens playing video/photo preview with native video controls and thumbnails',()=>{
 const h=harness();try{
  const video=new h.win.File(['movie'],'short.mp4',{type:'video/mp4'});
  const photo=new h.win.File(['image'],'photo.jpg',{type:'image/jpeg'});
  h.choose(photo,video);
  assert.equal(h.composer.getState().stage,'preview');
  assert.equal(h.d.querySelector('.luonix-v10-stage img')?.alt,'Selected photo 1 of 2');
  assert.equal(h.d.querySelectorAll('.luonix-v10-thumb').length,2);
  h.click('.luonix-v10-media-controls button:nth-child(2)');
  assert.equal(h.d.querySelector('.luonix-v10-stage video')?.controls,true);
  assert.equal(h.d.querySelector('.luonix-v10-stage video')?.playsInline,true);
  assert.equal(h.d.querySelector('.luonix-v10-thumbs [aria-pressed=true]')?.getAttribute('aria-label'),'View selected media 2');
  assert.equal(h.uploads.length,0,'preview must never upload');
 }finally{h.done()}
});

test('privacy second page is explicit and gallery media is published with original authorized RPC',async()=>{
 const h=harness();try{
  const photo=new h.win.File(['image'],'photo.jpg',{type:'image/jpeg'});
  const video=new h.win.File(['movie'],'movie.webm',{type:'video/webm'});
  h.choose(photo,video);
  h.click('.luonix-v10-next');
  assert.equal(h.composer.getState().stage,'audience');
  h.click('.luonix-v10-audience-item[data-value=public]');
  assert.equal(h.composer.getState().audience,'public');
  h.click('.luonix-v10-next');await tick();
  const create=h.calls.find(x=>x.action==='entry.create'),publish=h.calls.find(x=>x.action==='entry.publish');
  assert.equal(create.input.kind,'post');
  assert.equal(create.input.audience,'public');
  assert.equal(publish.input.media.length,2);
  assert.equal(h.uploads.length,2);
  assert.ok(h.uploads.every(u=>u.options.upsert===false));
  assert.equal(h.actions.includes('published'),true);
  assert.equal(h.revoked.length,2);
 }finally{h.done()}
});

test('only one click publishes; interrupted media keeps the same entry and skips already-uploaded files on retry',async()=>{
 const h=harness({deferUpload:true});try{
  const a=new h.win.File(['a'],'a.jpg',{type:'image/jpeg'}),b=new h.win.File(['b'],'b.jpg',{type:'image/jpeg'});
  h.choose(a,b);h.click('.luonix-v10-next');h.click('.luonix-v10-next');h.click('.luonix-v10-next');
  await tick();
  assert.equal(h.calls.filter(x=>x.action==='entry.create').length,1);
  assert.equal(h.getRequestCount(),1,'double-submit must not dispatch another upload');
  h.releaseUpload({data:{path:h.uploads[0].path},error:null});await tick();
  assert.equal(h.getRequestCount(),2);
  h.releaseUpload({data:null,error:{message:'network dropped'}});await tick();
  assert.match(h.d.querySelector('.luonix-v10-message').textContent,/retry/i);
  h.click('.luonix-v10-next');await tick();
  assert.equal(h.calls.filter(x=>x.action==='entry.create').length,1,'must not create a new duplicate');
  assert.equal(h.getRequestCount(),3);
  h.releaseUpload({data:{path:h.uploads[2].path},error:null});await tick();
  assert.equal(h.calls.filter(x=>x.action==='entry.publish').length,1);
  assert.equal(h.calls.find(x=>x.action==='entry.publish').input.media.length,2);
 }finally{h.done()}
});

test('sign out during upload stops publishing and avoids announcing success',async()=>{
 const h=harness({deferUpload:true});try{
  const photo=new h.win.File(['a'],'safe.jpg',{type:'image/jpeg'});
  h.choose(photo);h.click('.luonix-v10-next');h.click('.luonix-v10-next');await tick();
  assert.equal(h.getRequestCount(),1);
  h.setActor(null);
  h.releaseUpload({data:{path:h.uploads[0].path},error:null});await tick();
  assert.equal(h.calls.filter(x=>x.action==='entry.publish').length,0);
  assert.equal(h.actions.includes('published'),false);
 }finally{h.done()}
});

test('mounted routes and styles keep Luonix and classic posts in the same creator',async()=>{
 const social=await readFile('src/social-spaces.js','utf8');
 const html=await readFile('public/index.html','utf8');
 const style=await readFile('public/luonix-media-v10.css','utf8');
 const feed=await readFile('src/social-feed.js','utf8');
 assert.match(social,/mountLuonixMediaPublisher/);
 assert.match(social,/key==='compose'\|\|key==='publish-clip'/);
 assert.match(social,/key==='clip-studio'/);
 assert.match(html,/href="\/luonix-media-v10\.css"/);
 assert.match(style,/height:100dvh/);
 assert.match(feed,/luo-feed-post-media/);
});
