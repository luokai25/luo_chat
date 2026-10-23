import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {classifyMessageEffect,installChatAtmosphere} from '../src/chat-atmosphere.js';

function setup({reduced=false,saveData=false}={}) {
 const dom=new JSDOM('<!doctype html><html><head></head><body><section id="room" class="active"><details id="roomMenu"><div class="room-menu-items"></div></details><div id="messages"></div></section></body></html>',{url:'https://luo.example',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=()=>({matches:reduced});
 Object.defineProperty(w.navigator,'connection',{value:{saveData},configurable:true});
 let owner='account-a',room='room-a';const app=installChatAtmosphere({win:w,getUser:()=>owner?{id:owner}:null,getRoom:()=>room});
 const msg=(body,type='text')=>({body,message_type:type,conversation_id:room});
 return {dom,w,app,msg,button:w.document.querySelector('.luo-atmosphere-toggle'),particles:()=>w.document.querySelectorAll('.luo-atmosphere-particle'),setRoom:r=>room=r,setOwner:o=>owner=o};
}
test('classifies requested emoji effects without parsing HTML or media attachments',()=>{
 assert.equal(classifyMessageEffect({body:'✨'}).kind,'stars');
 assert.equal(classifyMessageEffect({body:'💛'}).kind,'hearts');
 assert.equal(classifyMessageEffect({body:'🎉'}).kind,'fireworks');
 assert.equal(classifyMessageEffect({body:'🎉',message_type:'image'}),null);
 assert.equal(classifyMessageEffect({body:'ordinary note'}),null);
});
test('chat effects run only for the active room and never interpolate message HTML',()=>{
 const h=setup();
 assert.equal(h.app.onMessage({body:'🎆',message_type:'text',conversation_id:'other'}),false);
 assert.equal(h.particles().length,0);
 assert.equal(h.app.onMessage(h.msg('🎆 <img src=x onerror=alert(1)>')),true);
 assert.ok(h.particles().length>0);
 assert.equal(h.w.document.querySelector('.luo-atmosphere-overlay img'),null);
 h.app.signedOut();assert.equal(h.particles().length,0);h.dom.window.close();
});
test('individual conversation setting persists without storing any message data',()=>{
 const h=setup();const k='luo-chat-effects:account-a:room-a';
 h.button.click();assert.equal(h.w.localStorage.getItem(k),'full');
 h.button.click();assert.equal(h.w.localStorage.getItem(k),'off');
 assert.equal(h.app.onMessage(h.msg('⭐')),false);
 h.setRoom('room-b');h.app.onRoom();assert.match(h.button.textContent,/Subtle/);
 assert.equal(h.w.localStorage.getItem('luo-chat-effects:account-a:room-b'),null);
 h.app.signedOut();h.dom.window.close();
});
test('reduced-motion and data-saving mode suppress all particles even when full is selected',()=>{
 for(const opts of [{reduced:true},{saveData:true}]){
  const h=setup(opts);h.button.click();
  assert.equal(h.app.onMessage(h.msg('🎉')),false);
  assert.equal(h.particles().length,0);
  assert.equal(h.w.document.querySelector('#messages').classList.contains('luo-reactive-wallpaper'),false);
  h.dom.window.close();
 }
});
