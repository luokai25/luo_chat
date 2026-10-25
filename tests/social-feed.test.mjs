import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountSocialFeed} from '../src/social-feed.js';
import {SUPABASE_URL} from '../src/config.js';
const tick=()=>new Promise(r=>setImmediate(r));
const entry=(id='one',kind='post',overrides={})=>({id,kind,owner_id:'friend',published:true,audience:'friends',body:'A small golden moment',created_at:'2026-10-24T08:00:00Z',author:{id:'friend',username:'kai',display_name:'Kai'},media:[],mine:{},...overrides});
function pending(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function setup({mode='friends',clipsOnly=false,rpc,sign,reduced=false,saver=false,initialClip=null}={}){
 const dom=new JSDOM('<div id="out"></div>',{url:'https://luo.example',pretendToBeVisual:true}),w=dom.window,d=w.document;
 const calls=[],notes=[],profiles=[],observers=[],playing=[],paused=[];let actor={id:'me'},stopped=false;
 w.matchMedia=()=>({matches:reduced});Object.defineProperty(w.navigator,'connection',{value:{saveData:saver}});
 const playback=new WeakMap();Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return !playback.get(this)},configurable:true});
 w.HTMLMediaElement.prototype.play=function(){playback.set(this,true);playing.push(this);this.dispatchEvent(new w.Event('play'));return Promise.resolve()};
 w.HTMLMediaElement.prototype.pause=function(){playback.set(this,false);paused.push(this);this.dispatchEvent(new w.Event('pause'))};w.HTMLMediaElement.prototype.load=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'))};
 w.IntersectionObserver=class{constructor(callback){this.callback=callback;observers.push(this)}observe(){}unobserve(){}disconnect(){this.disconnected=true}};
 const db={rpc:async(name,args)=>{calls.push(args);return rpc?await rpc(args):{data:args.action==='feed'&&args.input.kind==='post'?[entry()]:[]}},storage:{from:()=>({createSignedUrl:async path=>sign?sign(path):{data:{signedUrl:SUPABASE_URL+'/storage/v1/object/sign/luo-social/'+path+'?token=test'}}})}};
 const stop=mountSocialFeed({win:w,db,getUser:()=>actor,output:d.getElementById('out'),note:s=>notes.push(s),openPerson:id=>profiles.push(id),mode,clipsOnly,initialClip});
 return {w,d,calls,notes,profiles,observers,playing,paused,stop:()=>{if(!stopped){stop();stopped=true}},actor:value=>{actor=value},close(){this.stop();w.close()}};
}
const find=(h,name)=>[...h.d.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===name);

test('Friends loads authorized posts and clips with explicit server mode and safe text',async()=>{
 const h=setup({rpc:async({input})=>({data:input.kind==='post'?[entry('one','post',{body:'<img src=x onerror=alert(1)>'})]:[]})});
 try{await tick();assert.deepEqual(h.calls.map(x=>[x.input.kind,x.input.mode]),[['post','friends'],['clip','friends']]);assert.match(h.d.body.textContent,/onerror=alert/);assert.equal(h.d.querySelector('img'),null);assert.equal(h.d.querySelectorAll('.luo-feed-card').length,1)}finally{h.close()}
});
test('Public excludes friends-only, private and unpublished rows even if returned by the API',async()=>{
 const h=setup({mode:'public',rpc:async({input})=>({data:input.kind==='post'?[entry('public','post',{audience:'public'}),entry('private','post',{audience:'private'}),entry('friends'),entry('draft','post',{audience:'public',published:false})]:[]})});
 try{await tick();assert.deepEqual([...h.d.querySelectorAll('.luo-feed-card')].map(x=>x.dataset.entryId),['public']);assert.ok(h.calls.every(x=>x.input.mode==='public'))}finally{h.close()}
});
test('profiles open from both the avatar and author name',async()=>{
 const h=setup();try{await tick();h.d.querySelector('.luo-feed-avatar').click();h.d.querySelector('.luo-feed-name').click();assert.deepEqual(h.profiles,['friend','friend'])}finally{h.close()}
});
test('Love and Save update in place after confirmation without reloading the feed',async()=>{
 const h=setup();try{await tick();const card=h.d.querySelector('.luo-feed-card'),love=find(h,'Love · 0');love.click();await tick();assert.equal(love.getAttribute('aria-pressed'),'true');assert.equal(love.getAttribute('aria-label'),'Love · 1');find(h,'Save').click();await tick();assert.ok(find(h,'Unsave'));assert.equal(h.d.querySelector('.luo-feed-card'),card);assert.equal(h.calls.filter(x=>x.action==='feed').length,2);love.click();await tick();assert.equal(love.getAttribute('aria-label'),'Love · 0')}finally{h.close()}
});
test('failed reaction preserves its previous state and allows a retry',async()=>{
 const h=setup({rpc:async args=>args.action==='feed'?{data:args.input.kind==='post'?[entry()]:[]}:{error:{message:'Please slow down'}}});try{await tick();const b=find(h,'Love · 0');b.click();await tick();assert.equal(b.getAttribute('aria-pressed'),'false');assert.equal(b.disabled,false);assert.match(h.notes[0],/slow down/)}finally{h.close()}
});
test('pagination uses each stream cursor, suppresses duplicates and stops at the end',async()=>{
 const rows=Array.from({length:20},(_,i)=>entry(String(i),'post',{created_at:'2026-10-24T07:00:00Z'}));
 const h=setup({rpc:async({input})=>({data:input.kind==='clip'?[]:input.before?[rows[19],entry('older')]:rows})});try{await tick();assert.equal(h.d.querySelectorAll('.luo-feed-card').length,20);find(h,'Load more').click();await tick();const pages=h.calls.filter(x=>x.action==='feed'&&x.input.kind==='post');assert.equal(pages[1].input.before,rows[19].created_at);assert.equal(pages[1].input.before_id,'19');assert.equal(h.d.querySelectorAll('.luo-feed-card').length,21);assert.equal(find(h,'Load more').hidden,true)}finally{h.close()}
});
test('one failed stream can retry without duplicating the successful stream',async()=>{
 let clips=0;const h=setup({rpc:async({input})=>input.kind==='post'?{data:[entry()]}:++clips===1?{error:{message:'Temporary network error'}}:{data:[]}});
 try{await tick();assert.match(h.d.body.textContent,/Temporary network/);find(h,'Load more').click();await tick();assert.equal(h.d.querySelectorAll('.luo-feed-card').length,1);assert.equal(h.calls.filter(x=>x.input.kind==='post').length,1)}finally{h.close()}
});
test('late responses cannot render after account change or unmount',async()=>{
 const p=pending(),h=setup({rpc:()=>p.promise});try{h.actor({id:'other'});p.resolve({data:[entry()]});await tick();assert.equal(h.d.querySelectorAll('.luo-feed-card').length,0);h.stop();assert.equal(h.d.querySelector('.luo-feed'),null)}finally{h.close()}
});
test('Clip media loads lazily, plays one at a time, and is released when leaving',async()=>{
 const rows=[entry('a','clip',{media:[{path:'friend/a/video.mp4'}]}),entry('b','clip',{media:[{path:'friend/b/video.mp4'}]})];const h=setup({clipsOnly:true,rpc:async()=>({data:rows})});
 try{await tick();assert.equal(h.d.querySelector('video'),null);const buttons=h.d.querySelectorAll('.luo-feed-play');buttons[0].click();await tick();const first=h.d.querySelector('video');assert.ok(first);assert.equal(first.muted,true);buttons[1].click();await tick();assert.ok(h.paused.includes(first));find(h,'Unmute').click();await tick();assert.ok([...h.d.querySelectorAll('video')].every(v=>v.muted===false));const videos=[...h.d.querySelectorAll('video')];h.stop();assert.ok(videos.every(v=>!v.hasAttribute('src')));assert.equal(h.observers[0].disconnected,true)}finally{h.close()}
});
test('invalid media host is rejected before any video is created',async()=>{
 const h=setup({clipsOnly:true,rpc:async()=>({data:[entry('a','clip',{media:[{path:'friend/a/video.mp4'}]})]}),sign:async()=>({data:{signedUrl:'https://evil.example/video.mp4'}})});
 try{await tick();find(h,'Play clip').click();await tick();assert.equal(h.d.querySelector('video'),null);assert.match(h.notes[0],/Unexpected media host/)}finally{h.close()}
});
test('a clip scrolled away while loading cannot start playing after its signed URL arrives',async()=>{
 const p=pending(),h=setup({clipsOnly:true,rpc:async()=>({data:[entry('a','clip',{media:[{path:'friend/a/video.mp4'}]})]}),sign:()=>p.promise});
 try{await tick();find(h,'Play clip').click();const card=h.d.querySelector('.luo-feed-card');h.observers[0].callback([{target:card,isIntersecting:false,intersectionRatio:0}]);p.resolve({data:{signedUrl:SUPABASE_URL+'/storage/v1/object/sign/luo-social/friend/a/video.mp4'}});await tick();assert.equal(h.playing.length,0)}finally{h.close()}
});
test('reduced motion and data saving prevent automatic next-clip playback',async()=>{
 for(const options of [{reduced:true},{saver:true}]){
  const h=setup({...options,clipsOnly:true,rpc:async()=>({data:[entry('a','clip',{media:[{path:'friend/a/video.mp4'}]}),entry('b','clip',{media:[{path:'friend/b/video.mp4'}]})]})});
  try{await tick();find(h,'Play clip').click();await tick();const cards=h.d.querySelectorAll('.luo-feed-card');h.observers[0].callback([{target:cards[1],isIntersecting:true,intersectionRatio:1}]);await tick();assert.equal(h.playing.length,1)}finally{h.close()}
 }
});
test('comments render as safe text; retry reuses operation ID and keeps the unsent draft',async()=>{
 let attempts=0;const h=setup({rpc:async args=>args.action==='feed'?{data:args.input.kind==='post'?[entry()]:[]}:args.action==='responses'?{data:[{username:'reader',body:'<script>bad</script>'}]}:++attempts===1?{error:{message:'Connection failed'}}:{data:{}}});
 try{await tick();find(h,'Comments · 0').click();await tick();const sheet=h.d.querySelector('dialog');assert.equal(sheet.open,true);assert.equal(sheet.querySelector('script'),null);const field=sheet.querySelector('textarea');field.value='My reply';const send=()=>sheet.querySelector('form').dispatchEvent(new h.w.Event('submit',{cancelable:true}));send();await tick();assert.equal(field.value,'My reply');send();await tick();assert.equal(field.value,'');const writes=h.calls.filter(x=>x.action==='response');assert.equal(writes[0].input.operation,writes[1].input.operation);assert.ok(find(h,'Comments · 1'));find(h,'Close comments').click();assert.equal(sheet.open,false)}finally{h.close()}
});
test('closing comments or switching account discards pending comments',async()=>{
 const p=pending(),h=setup({rpc:async args=>args.action==='feed'?{data:args.input.kind==='post'?[entry()]:[]}:await p.promise});
 try{await tick();find(h,'Comments · 0').click();find(h,'Close comments').click();p.resolve({data:[{body:'PRIVATE COMMENT'}]});await tick();assert.doesNotMatch(h.d.body.textContent,/PRIVATE COMMENT/)}finally{h.close()}
});

test('photo carousel signs only owned paths and advances without replacing the post',async()=>{
 const h=setup({rpc:async args=>({data:args.input.kind==='post'?[entry('album','post',{media:[{path:'friend/album/first.png'},{path:'friend/album/second.webp'}]})]:[]})});
 try{await tick();const card=h.d.querySelector('.luo-feed-card');find(h,'View photo').click();await tick();assert.match(h.d.querySelector('.luo-feed-stage img').src,/first\.png/);find(h,'Next photo').click();await tick();assert.match(h.d.querySelector('.luo-feed-stage img').src,/second\.webp/);assert.equal(h.d.querySelector('.luo-feed-card'),card);assert.match(h.d.querySelector('.luo-feed-carousel').textContent,/2 \/ 2/)}finally{h.close()}
});

const clipRows=(n=2)=>Array.from({length:n},(_,i)=>entry('clip-'+i,'clip',{media:[{path:'friend/clip-'+i+'/video.mp4'}]}));
test('Reels single tap pauses; double tap likes once without accidentally unliking',async()=>{
 const h=setup({clipsOnly:true,rpc:async a=>({data:a.action==='feed'?clipRows(1):{}})});
 try{await tick();find(h,'Play clip').click();await tick();const video=h.d.querySelector('video');video.click();await new Promise(r=>setTimeout(r,270));assert.ok(h.paused.includes(video));
  video.dispatchEvent(new h.w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();assert.equal(find(h,'Love · 1').getAttribute('aria-pressed'),'true');
  video.dispatchEvent(new h.w.MouseEvent('dblclick',{bubbles:true}));await tick();assert.equal(h.calls.filter(a=>a.action==='response').length,1);assert.ok(h.d.querySelector('.luo-reels-heart'));
 }finally{h.close()}
});
test('seeking validates duration and restores hold playback speed on cancellation',async()=>{
 const h=setup({clipsOnly:true,rpc:async()=>({data:clipRows(1)})});try{await tick();find(h,'Play clip').click();await tick();const video=h.d.querySelector('video'),seek=h.d.querySelector('input[type=range]');Object.defineProperty(video,'duration',{value:80});Object.defineProperty(video,'paused',{get:()=>false});video.dispatchEvent(new h.w.Event('loadedmetadata'));seek.value='25';seek.dispatchEvent(new h.w.Event('input'));assert.equal(video.currentTime,20);
  const stage=h.d.querySelector('.luo-feed-stage');stage.onpointerdown({target:video,button:0,clientX:20,clientY:20});await new Promise(r=>setTimeout(r,470));assert.equal(video.playbackRate,2);stage.onpointercancel();assert.equal(video.playbackRate,1);
 }finally{h.close()}
});
test('only active clip and immediate neighbours keep their media resident',async()=>{
 const h=setup({clipsOnly:true,rpc:async()=>({data:clipRows(6)})});try{await tick();for(let i=0;i<6;i++){h.d.querySelectorAll('.luo-feed-play')[i].click();await tick()}assert.ok(h.d.querySelectorAll('video').length<=3);assert.ok(!h.d.querySelector('.luo-feed-card').querySelector('video'))}finally{h.close()}
});
test('comment pagination uses server UUID cursor and deduplicates repeated rows',async()=>{
 const rows=Array.from({length:50},(_,i)=>({id:'comment-'+i,username:'reader',body:'Reply '+i,created_at:'2026-10-25T10:00:00Z'}));
 const h=setup({rpc:async a=>({data:a.action==='feed'?(a.input.kind==='post'?[entry()]:[]):a.input.after?[rows[49],{id:'older',body:'More'}]:rows})});
 try{await tick();find(h,'Comments · 0').click();await tick();find(h,'More comments').click();await tick();assert.equal(h.calls.find(a=>a.input.after)?.input.after,'comment-49');assert.equal(h.d.querySelectorAll('.luo-feed-comment').length,51);assert.equal(find(h,'More comments').hidden,true)}finally{h.close()}
});
test('share links contain only the entry ID, never signed media URLs',async()=>{
 let copied;const h=setup({clipsOnly:true,rpc:async()=>({data:clipRows(1)})});Object.defineProperty(h.w.navigator,'clipboard',{value:{writeText:async x=>{copied=x}}});
 try{await tick();find(h,'Share clip').click();await tick();find(h,'Copy link').click();await tick();assert.equal(copied,'https://luo.example/#luo-clip=clip-0');assert.doesNotMatch(copied,/token|storage/)}finally{h.close()}
});
test('report is persisted only after a valid reason, with no fabricated success',async()=>{
 const h=setup({clipsOnly:true,rpc:async a=>a.action==='feed'?{data:clipRows(1)}:{error:{message:'Report denied'}}});try{await tick();find(h,'More options').click();await tick();find(h,'Submit report').click();await tick();assert.equal(h.calls.filter(a=>a.action==='response').length,0);h.d.querySelector('.luo-report-reason').value='Harmful content';find(h,'Submit report').click();await tick();assert.equal(h.calls.at(-1).input.kind,'report');assert.match(h.notes.at(-1),/Report denied/);assert.doesNotMatch(h.d.querySelector('dialog').textContent,/Report submitted/)}finally{h.close()}
});
test('a shared clip requires an authorized entry lookup and cannot expose denied content',async()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const h=setup({clipsOnly:true,initialClip:id,rpc:async a=>a.action==='entry.get'?{error:{message:'Content unavailable'}}:{data:[]}});
 try{await tick();assert.equal(h.calls[0].action,'entry.get');assert.equal(h.calls[0].input.id,id);assert.equal(h.d.querySelectorAll('.luo-feed-card').length,0);assert.match(h.notes[0],/unavailable/);assert.ok(h.calls.some(a=>a.action==='feed'))}finally{h.close()}
});
test('shared clip lookup is discarded when the account changes before completion',async()=>{
 const p=pending(),h=setup({clipsOnly:true,initialClip:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rpc:()=>p.promise});
 try{h.actor({id:'other'});p.resolve({data:entry('private','clip',{body:'Private shared clip'})});await tick();assert.equal(h.d.querySelectorAll('.luo-feed-card').length,0);assert.equal(h.calls.length,1)}finally{h.close()}
});
