import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installChatNotesRibbon} from '../src/chat-notes-ribbon.js';

const tick=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setTimeout(resolve,0))};
function setup(responses=[],delay=null){
 const dom=new JSDOM('<!doctype html><html><head></head><body><main id="chatlist"></main></body></html>',{url:'https://luo.example/',pretendToBeVisual:true});
 const win=dom.window,doc=win.document,requests=[];let actor={id:'account-1'},opened=0;
 const db={rpc:async(name,args)=>{requests.push({name,...args});if(delay)await delay;return {data:responses,error:null}}};
 const api=installChatNotesRibbon({win,db,getUser:()=>actor,openNotes:()=>{opened++}});
 return {dom,win,doc,api,requests,getOpened:()=>opened,setActor:v=>actor=v};
}
test('private note data uses text-only rendering and opens the real Social Notes section',async()=>{
 const h=setup([{id:'n1',kind:'note',author:{id:'friend-1',display_name:'<b>Friend</b>'},body:'<img src=x onerror=alert(1)> golden✨'}]);
 h.api.onTab('chats');await tick();
 assert.equal(h.requests.length,1);
 assert.deepEqual(h.requests[0],{name:'luo_space',action:'feed',input:{kind:'note'}});
 const card=h.doc.querySelector('.luo-chat-notes-card');assert.ok(card);
 assert.match(card.textContent,/onerror=alert/);
 assert.equal(card.querySelector('img'),null);
 assert.equal(card.querySelector('b'),null);
 card.click();assert.equal(h.getOpened(),1);
 h.doc.querySelector('.luo-chat-notes-add').click();assert.equal(h.getOpened(),2);
 h.dom.window.close();
});
test('expired Notes and duplicate authors are filtered before rendering',async()=>{
 const h=setup([{kind:'note',id:'old',owner_id:'a',expires_at:new Date(Date.now()-5000).toISOString(),body:'Expired'},{kind:'note',id:'fresh',owner_id:'b',expires_at:new Date(Date.now()+300000).toISOString(),body:'Hello'},{kind:'note',id:'duplicate',owner_id:'b',body:'Should not repeat'},{kind:'post',id:'different',body:'No'}]);
 h.api.onTab('chats');await tick();
 assert.equal(h.doc.querySelectorAll('.luo-chat-notes-card').length,1);
 assert.match(h.doc.querySelector('.luo-chat-notes-card').textContent,/Hello/);
 assert.doesNotMatch(h.doc.querySelector('.luo-chat-notes').textContent,/Expired|Should not repeat/);
 h.dom.window.close();
});
test('account signout invalidates delayed note responses and hides private content',async()=>{
 let resolve;const hold=new Promise(r=>resolve=r);
 const h=setup([{kind:'note',id:'secret',body:'Old account note'}],hold);
 h.api.onTab('chats');await Promise.resolve();
 h.setActor(null);h.api.signedOut();resolve();await tick();
 assert.equal(h.doc.querySelector('.luo-chat-notes').hidden,true);
 assert.equal(h.doc.querySelectorAll('.luo-chat-notes-card').length,0);
 h.dom.window.close();
});
test('leaving Chats during a fetch prevents old notes from rendering on another page',async()=>{
 let resolve;const hold=new Promise(r=>resolve=r);
 const h=setup([{kind:'note',id:'n',body:'Private'}],hold);
 h.api.onTab('chats');await Promise.resolve();h.api.onTab('social');resolve();await tick();
 assert.equal(h.doc.querySelectorAll('.luo-chat-notes-card').length,0);
 h.dom.window.close();
});
