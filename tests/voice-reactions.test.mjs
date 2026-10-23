import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installQuickVoiceReplies} from '../src/voice-reactions.js';

function harness({holdPermission=null,deny=false}={}) {
 const dom=new JSDOM('<!doctype html><html><head></head><body><section id="room" class="active"><div id="messages"></div></section></body></html>',{url:'https://luo.example',pretendToBeVisual:true});
 const win=dom.window,doc=win.document;let owner={id:'user-1'},room='room-1',stops=0,permissionCalls=0;
 const submitted=[],messages=[];
 const stream={getTracks:()=>[{stop(){stops++}}]};
 win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 win.HTMLMediaElement.prototype.pause=function(){};
 win.URL.createObjectURL=()=> 'blob:https://luo.example/fake';
 win.URL.revokeObjectURL=()=>{};
 class Recorder {
  static isTypeSupported(type){return type.startsWith('audio/webm')}
  constructor(){this.mimeType='audio/webm';this.state='inactive'}
  start(){this.state='recording'}
  stop(){this.state='inactive';this.ondataavailable?.({data:new win.Blob(['voice data'],{type:'audio/webm'})});this.onstop?.()}
 }
 win.MediaRecorder=Recorder;
 win.navigator.mediaDevices={getUserMedia:async()=>{permissionCalls++;if(deny)throw Object.assign(new Error('Not allowed'),{name:'NotAllowedError'});if(holdPermission)await holdPermission;return stream}};
 const api=installQuickVoiceReplies({win,getUser:()=>owner,getRoom:()=>room,onSend:async args=>{submitted.push(args);return true},note:m=>messages.push(m)});
 const message={id:'message-1',conversation_id:room,message_type:'text',body:'A normal written text'};
 const node=doc.createElement('article');doc.getElementById('messages').append(node);api.decorateMessage(node,message);
 const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setTimeout(r,0))};
 return {dom,win,doc,api,node,submitted,messages,flush,record:()=>[...doc.querySelectorAll('#luoQuickVoiceReply button')].find(b=>b.textContent==='Record').click(),click:text=>[...doc.querySelectorAll('#luoQuickVoiceReply button')].find(b=>b.textContent===text).click(),getStops:()=>stops,getPermissionCalls:()=>permissionCalls,setOwner:o=>owner=o,setRoom:v=>room=v};
}
test('a voice reaction to ordinary text records under two seconds and stages a linked private audio reply',async()=>{
 const h=harness();
 const trigger=h.node.querySelector('.luo-voice-reaction-action');assert.ok(trigger);
 trigger.click();assert.equal(h.api.dialog.open,true);
 assert.equal(h.getPermissionCalls(),0,'opening reaction must not prompt for microphone');
 h.record();await h.flush();
 assert.equal(h.getPermissionCalls(),1);
 assert.equal(h.api.dialog.dataset.state,'recording');
 h.click('Stop');await h.flush();
 assert.equal(h.api.dialog.dataset.state,'preview');
 assert.equal(h.doc.querySelector('audio').hidden,false);
 h.click('Send voice reaction');await h.flush();
 assert.equal(h.submitted.length,1);
 assert.equal(h.submitted[0].messageId,'message-1');
 assert.equal(h.submitted[0].roomId,'room-1');
 assert.equal(h.submitted[0].ownerId,'user-1');
 assert.equal(h.submitted[0].file.type,'audio/webm');
 assert.ok(h.submitted[0].file.size>0);
 assert.equal(h.getStops(),1);
 assert.equal(h.api.dialog.open,false);
 h.dom.window.close();
});
test('close during permission request releases late microphone grant and cannot stage an audio reply',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const h=harness({holdPermission:gate});
 h.node.querySelector('.luo-voice-reaction-action').click();h.record();
 await Promise.resolve();h.click('Close');release();await h.flush();
 assert.equal(h.getStops(),1);
 assert.equal(h.submitted.length,0);
 assert.equal(h.api.dialog.open,false);
 h.dom.window.close();
});
test('account signout immediately stops active recording and discards preview bytes',async()=>{
 const h=harness();h.node.querySelector('.luo-voice-reaction-action').click();h.record();await h.flush();
 h.setOwner(null);h.api.signedOut();
 assert.equal(h.getStops(),1);
 assert.equal(h.api.dialog.open,false);
 assert.equal(h.doc.querySelector('audio').getAttribute('src'),null);
 assert.equal(h.submitted.length,0);
 h.dom.window.close();
});
test('permission denial gives recovery guidance and does not send a reply',async()=>{
 const h=harness({deny:true});h.node.querySelector('.luo-voice-reaction-action').click();h.record();await h.flush();
 assert.match(h.doc.querySelector('.luo-voice-reaction-status').textContent,/Microphone blocked/);
 assert.equal(h.submitted.length,0);
 h.dom.window.close();
});
