import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

// Exercise only the first mobile-stability boot IIFE. The second one manages
// calls, notifications and media; it is unrelated to initial session display.
const full=await readFile('public/luo-mobile-stability.js','utf8');
const startupScript=full.split('/* Luo Chat integrated call buttons,')[0];

function makeBoot({returning=true}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div class="app" data-screen="auth"></div></body></html>',{
  url:'https://luo-chat-luokai25.vercel.app/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const {window:win}=dom;
 if(returning)win.document.documentElement.classList.add('luo-restoring-session');
 const scheduled=[];
 win.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
 win.eval(startupScript);
 win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
 return {dom,win,scheduled,root:win.document.documentElement,app:win.document.querySelector('.app')};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('existing Android user never sees sign-in solely because restoration is slow',async()=>{
 const t=makeBoot();
 try{
  assert.equal(t.scheduled.length,1);
  assert.equal(t.scheduled[0].delay,3500);
  t.scheduled[0].callback();
  assert.equal(t.root.classList.contains('luo-restoring-session'),true);
  const panel=t.win.document.getElementById('luoSessionSlowRecovery');
  assert.ok(panel);
  assert.match(panel.textContent,/still restoring/i);
  assert.equal(panel.querySelector('button').textContent,'Sign in instead');
  t.app.dataset.screen='home';
  await settle();
  assert.equal(t.root.classList.contains('luo-restoring-session'),false);
  assert.equal(t.win.document.getElementById('luoSessionSlowRecovery'),null);
 }finally{t.dom.window.close()}
});

test('returning user can explicitly open sign-in after delayed recovery',()=>{
 const t=makeBoot();
 try{
  t.scheduled[0].callback();
  assert.ok(t.root.classList.contains('luo-restoring-session'));
  t.win.document.querySelector('#luoSessionSlowRecovery button').click();
  assert.equal(t.root.classList.contains('luo-restoring-session'),false);
  assert.equal(t.win.document.getElementById('luoSessionSlowRecovery'),null);
 }finally{t.dom.window.close()}
});

test('new users see login immediately with no restoration overlay',()=>{
 const t=makeBoot({returning:false});
 try{
  assert.equal(t.scheduled.length,0);
  assert.equal(t.root.classList.contains('luo-restoring-session'),false);
  assert.equal(t.win.document.getElementById('luoSessionSlowRecovery'),null);
 }finally{t.dom.window.close()}
});

test('invalid session resolution dismisses recovery panel without requiring a click',async()=>{
 const t=makeBoot();
 try{
  t.scheduled[0].callback();
  t.root.classList.remove('luo-restoring-session');
  await settle();
  assert.equal(t.win.document.getElementById('luoSessionSlowRecovery'),null);
 }finally{t.dom.window.close()}
});
