import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installSocialSessions} from '../src/social-sessions.js';

test('Watch Together is backed by member-visible chat attachments, not arbitrary media URLs',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><div id="out"></div></body></html>',{url:'https://luo.example'});
 const w=dom.window,d=w.document,calls=[];
 Object.defineProperty(w.crypto,'randomUUID',{value:()=> '11111111-1111-4111-8111-111111111111'});
 const actor={id:'22222222-2222-4222-8222-222222222222'},room='33333333-3333-4333-8333-333333333333',message='44444444-4444-4444-8444-444444444444';
 const db={rpc:async(name,args)=>{calls.push({name,...args});return {data:args.action==='feed'?[]:{}}},from:name=>{
  assert.equal(name,'chat_attachments');
  return {select(){return this},eq(field,val){assert.equal(field,'conversation_id');assert.equal(val,room);return this},order(){return this},limit:async()=>({data:[{message_id:message,file_name:'clip.webm',mime_type:'video/webm'}],error:null})}
 }};
 const sessions=installSocialSessions({win:w,db,note:()=>{},getUser:()=>actor,getChats:()=>[{id:room,title:'Family'}]});
 await sessions.render(d.getElementById('out'));
 const selectors=d.querySelectorAll('.luo-social-card select');
 assert.equal(selectors.length,3);
 selectors[0].value=room;selectors[0].dispatchEvent(new w.Event('change'));await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(selectors[2].querySelectorAll('option').length,2);
 selectors[2].value=message;
 [...d.querySelectorAll('.luo-social-card button')].find(x=>x.textContent==='Start together').click();
 await new Promise(resolve=>setTimeout(resolve,15));
 const created=calls.find(x=>x.action==='entry.create');
 assert.ok(created);
 assert.equal(created.input.kind,'session');
 assert.equal(created.input.audience,'room');
 assert.equal(created.input.room_id,room);
 assert.equal(created.input.data.source_message,message);
 assert.ok(calls.find(x=>x.action==='entry.publish'));
 sessions.signedOut();w.close();
});
