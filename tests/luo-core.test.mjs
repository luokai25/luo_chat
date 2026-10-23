import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {LUO_CORE_FAMILIES,LUO_CORE_MOTIONS,createLuoCoreBrain} from '../src/luo-core-brain.js';
import {installLuoCore} from '../src/luo-core-overlay.js';
import {LUO_CORE_POSE_FAMILIES,synthesizeLuoCorePose} from '../src/luo-core-motion.js';

test('Luo Core defines 336 unique parametric motion variations across 42 families',()=>{
 assert.equal(LUO_CORE_FAMILIES.length,42);
 assert.equal(LUO_CORE_MOTIONS.length,336);
 assert.equal(new Set(LUO_CORE_MOTIONS.map(m=>m.id)).size,336);
 assert.ok(LUO_CORE_MOTIONS.every(m=>m.duration>0&&m.intensity>0));
});
test('companion behaviour preserves energy and affection boundaries and pauses when hidden',()=>{
 const brain=createLuoCoreBrain({random:()=>.12});
 for(let i=0;i<70;i++)brain.command('play');
 assert.ok(brain.snapshot().energy>=0);
 for(let i=0;i<30;i++)brain.command('pet');
 assert.equal(brain.snapshot().affection,1);
 const pause=brain.snapshot();
 brain.tick(900,{visible:false,motion:true});
 assert.equal(brain.snapshot().elapsed,pause.elapsed);
 brain.signal('new_message');
 assert.ok(brain.snapshot().eventCount>=1);
 brain.command('nap');
 assert.equal(brain.snapshot().state,'curl_up');
});
function host(){
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
 '<div class="app" data-screen="auth"><section id="room"><div id="messages">'+
 '<article class="message"><p class="bubble">PRIVATE SECRET: do not read this</p></article>'+
 '</div></section></div></body></html>',{
  url:'https://luo-chat-luokai25.vercel.app/',pretendToBeVisual:true
 });
 const w=dom.window,doc=w.document;
 let count=0,actor=null,pending=null;
 Object.defineProperty(w,'innerWidth',{value:390,configurable:true});
 Object.defineProperty(w,'innerHeight',{value:820,configurable:true});
 const gradient={addColorStop(){}};
 const ctx={clearRect(){count++},save(){},restore(){},translate(){},scale(){},
  createLinearGradient:()=>gradient,beginPath(){},ellipse(){},fill(){},moveTo(){},lineTo(){},closePath(){},bezierCurveTo(){},stroke(){}};
 w.HTMLCanvasElement.prototype.getContext=type=>type==='2d'?ctx:null;
 w.requestAnimationFrame=callback=>{pending=callback;return 1};
 w.cancelAnimationFrame=()=>{pending=null};
 w.matchMedia=()=>({matches:true});
 doc.getElementById('messages').querySelector('.bubble').getBoundingClientRect=()=>({
  left:25,top:270,width:280,height:48,right:305,bottom:318
 });
 const core=installLuoCore({win:w,getUser:()=>actor,random:()=>.2});
 const tick=(ms=16)=>{const next=pending;assert.ok(next);pending=null;next(ms)};
 return {dom,w,doc,core,tick,get drawCount(){return count},signIn:(id)=>{actor={id};doc.querySelector('.app').dataset.screen='home'},signOut:()=>{actor=null;doc.querySelector('.app').dataset.screen='auth'}};
}
test('Luo Core is private to an authenticated user, sits above texts, and is dismissible',()=>{
 const a=host();
 try{
  a.tick();
  assert.equal(a.core.visible,false);
  a.signIn('user-a');a.tick(40);
  assert.equal(a.core.visible,true);
  assert.equal(a.core.motionCount,336);
  const canvas=a.doc.querySelector('.luo-core-character');
  assert.ok(canvas);
  assert.equal(canvas.getAttribute('role'),'button');
  canvas.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:' ',bubbles:true}));
  assert.equal(a.doc.querySelector('.luo-core-menu').hidden,false);
  a.doc.querySelector('[data-action=play]').click();
  assert.equal(a.core.brain.snapshot().state,'play_yarn');
  canvas.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:' ',bubbles:true}));
  a.doc.querySelector('[data-action=hide]').click();
  assert.equal(a.core.visible,false);
  assert.equal(a.doc.querySelector('.luo-core-restore').hidden,false);
  assert.equal(a.w.localStorage.getItem('luo-core-enabled:user-a'),'false');
  a.doc.querySelector('.luo-core-restore').click();
  assert.equal(a.core.visible,true);
  assert.equal(a.w.localStorage.getItem('luo-core-enabled:user-a'),'true');
  a.signOut();a.core.signedOut();a.tick(70);
  assert.equal(a.core.visible,false);
 }finally{a.core.dispose();a.dom.window.close()}
});
test('Luo Core is account-scoped: hiding for one user never hides for another',()=>{
 const a=host();
 try{
  a.signIn('a');a.tick();
  a.doc.querySelector('.luo-core-character').dispatchEvent(new a.w.KeyboardEvent('keydown',{key:' ',bubbles:true}));
  a.doc.querySelector('[data-action=hide]').click();
  a.signOut();a.tick(32);
  a.signIn('b');a.tick(64);
  assert.equal(a.core.visible,true);
  assert.equal(a.w.localStorage.getItem('luo-core-enabled:b'),null);
 }finally{a.core.dispose();a.dom.window.close()}
});

test('all 42 motion families produce real distinct animated poses and variant amplitudes',()=>{
 assert.equal(LUO_CORE_POSE_FAMILIES.length,42);
 const samples=LUO_CORE_POSE_FAMILIES.map(name=>synthesizeLuoCorePose({state:name,variant:3,elapsed:500},4200,false));
 const signatures=new Set(samples.map(({family,moving,playful,resting,care,alert,...p})=>JSON.stringify(p)));
 assert.equal(signatures.size,42,'each movement family has its own visible pose');
 const a=synthesizeLuoCorePose({state:'play_yarn',variant:0,elapsed:500},4200,false);
 const b=synthesizeLuoCorePose({state:'play_yarn',variant:7,elapsed:500},4200,false);
 assert.notEqual(a.frontL,b.frontL,'variant intensity changes animated limbs');
 assert.ok(a.toy>0&&b.toy>0);
 const sleeping=synthesizeLuoCorePose({state:'sleep',variant:4,elapsed:450},4200,false);
 assert.equal(sleeping.eyeClose,1);
 assert.ok(sleeping.bodySquash<.7);
 const reduced=synthesizeLuoCorePose({state:'leap',variant:4,elapsed:500},4200,true);
 assert.equal(reduced.hop,0,'reduced motion removes bouncing while preserving a pose');
});

test('cat anchors to real visible bubbles and follows bubble scrolling without reading text',()=>{
 const a=host();
 try{
  a.signIn('scroll-user');a.doc.getElementById('room').classList.add('active');
  const bubble=a.doc.querySelector('.bubble');
  let top=270;
  bubble.getBoundingClientRect=()=>({left:25,top,width:280,height:48,right:305,bottom:top+48});
  a.tick(16);
  a.core.refresh();
  const canvas=a.doc.querySelector('.luo-core-character');
  // The first perch may use a hop; reduced-motion state snaps to the target.
  a.tick(50);
  assert.ok(canvas.style.transform.startsWith('translate3d('));
  const first=canvas.style.transform;
  top=360;
  a.w.dispatchEvent(new a.w.Event('scroll'));
  a.tick(90);
  assert.notEqual(canvas.style.transform,first,'perch follows message position');
  assert.ok(!a.core.brain.snapshot().eventCount,'scroll is not a message-read event');
 }finally{a.core.dispose();a.dom.window.close()}
});
