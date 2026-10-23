import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountCommunityModeration} from '../src/community-moderation.js';

const delay=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup({owner=true, responses={}}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><main id="out"></main></body></html>',{url:'https://luo.example'});
 const win=dom.window,doc=win.document,output=doc.getElementById('out'),requests=[],notices=[];
 let actor={id:owner?'owner-1':'visitor-2'};
 const entry={id:'comm-1',owner_id:'owner-1',title:'Dragon Realm',data:{slow_seconds:30,restricted:false}};
 const calls=async (action,input)=>{requests.push({action,input});const v=responses[action];if(typeof v==='function')return v(input);if(v instanceof Error)throw v;return v??[]};
 const wrapper=mountCommunityModeration({win,entry,output,call:calls,getUser:()=>actor,note:m=>notices.push(m)});
 const button=text=>{const b=[...output.querySelectorAll('button')].find(x=>x.textContent===text);assert.ok(b,'button '+text);return b};
 const flush=async()=>{for(let i=0;i<5;i++)await delay()};
 return {dom,win,doc,output,wrapper,requests,notices,button,flush,setActor:x=>actor=x};
}
test('a non-owner never sees any owner moderation controls',()=>{
 const h=setup({owner:false});assert.equal(h.wrapper,null);
 assert.equal(h.output.querySelectorAll('button').length,0);h.dom.window.close();
});
test('only accepted slow-mode settings and posting restrictions are submitted through authorized RPC',async()=>{
 const h=setup();assert.ok(h.wrapper);
 const sel=h.output.querySelector('.luo-community-mod-setting select'),check=h.output.querySelector('input[type=checkbox]');
 assert.equal(sel.value,'30');sel.value='300';check.checked=true;
 h.button('Save posting controls').click();await h.flush();
 assert.deepEqual(h.requests,[{action:'community.moderate',input:{id:'comm-1',slow_seconds:300,restricted:true}}]);
 assert.match(h.output.querySelector('[role=status]').textContent,/saved/);
 h.dom.window.close();
});
test('membership actions show pending approved and rejected members and route moderator decisions to server',async()=>{
 const h=setup({responses:{responses:input=>input.kind==='member'?[{user_id:'person-1',username:'friend',body:'pending'}]:[]}});
 h.button('Review members').click();await h.flush();
 assert.match(h.output.textContent,/friend/);
 h.button('Approve').click();await h.flush();
 assert.ok(h.requests.some(v=>v.action==='community.moderate'&&v.input.user_id==='person-1'&&v.input.decision==='member'));
 h.dom.window.close();
});
test('reported content remains visible only to the owner and untrusted report text is never injected as HTML',async()=>{
 const h=setup({responses:{responses:input=>input.kind==='report'?[{id:'r1',username:'<b>evil</b>',body:'<img src=x onerror=alert(1)>',created_at:new Date().toISOString()}]:[]}});
 h.button('Review reports').click();await h.flush();
 assert.match(h.output.textContent,/onerror=alert/);
 assert.equal(h.output.querySelector('img'),null);
 assert.equal(h.output.querySelector('b'),null);
 assert.match(h.output.textContent,/read-only/);
 h.dom.window.close();
});
test('old pending moderation response cannot render after account switches',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r);
 const h=setup({responses:{responses:async()=>{await gate;return[{user_id:'hidden-person',username:'private',body:'pending'}]}}});
 h.button('Review members').click();await delay();h.setActor({id:'new-account'});
 resolve();await h.flush();
 assert.doesNotMatch(h.output.textContent,/@private/);
 h.dom.window.close();
});
