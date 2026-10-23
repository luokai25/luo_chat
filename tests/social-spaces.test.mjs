import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installSocialSpaces} from '../src/social-spaces.js';

function harness(responses={}) {
 const dom=new JSDOM('<!doctype html><html><head></head><body><div class="app" data-tab="chats"><nav class="workspace-nav"><button data-tab="chats"></button><button data-tab="profile"></button></nav><section id="home"><section id="chats" class="sub"></section></section></div></body></html>',{url:'https://luo.example/'});
 const {window}=dom,doc=window.document,requests=[],messages=[];
 let owner={id:'10000000-0000-4000-8000-000000000001'};
 Object.defineProperty(window.crypto,'randomUUID',{value:()=> '20000000-0000-4000-8000-000000000002'});
 window.matchMedia=()=>({matches:true});
 const db={rpc:async(name,args)=>{requests.push({name,...args});const response=responses[args.action||name];if(response instanceof Error)return{error:{message:response.message}};return{data:typeof response==='function'?response(args.input):response||[]}}};
 const hub=installSocialSpaces({win:window,db,$:id=>doc.getElementById(id),note:value=>messages.push(value),getUser:()=>owner,getChats:()=>[],tab:name=>{doc.querySelector('.app').dataset.tab=name}});
 const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,0))};
 return {window,doc,db,hub,requests,messages,flush,setOwner:value=>owner=value};
}

test('Social hub attaches a dedicated tab and renders server-backed posts without using unsafe HTML',async()=>{
 const h=harness({'feed':[{kind:'post',id:'abc',author:{username:'friend'},body:'<img src=x onerror=alert(1)>',reactions:0,comments:0}]});
 assert.ok(h.doc.getElementById('social'));
 assert.equal(h.doc.querySelectorAll('[data-tab="social"]').length,1);
 h.doc.querySelector('[data-tab="social"]').click();
 await h.flush();
 assert.equal(h.doc.querySelectorAll('.luo-social-card img').length,0);
 assert.match(h.doc.querySelector('#social').textContent,/onerror=alert/);
 assert.ok(h.requests.some(x=>x.name==='luo_space'&&x.action==='feed'));
});

test('Sealed capsules never render private body and cannot be opened early',async()=>{
 const future=new Date(Date.now()+86400000).toISOString(),sealed={kind:'capsule',id:'abc',locked:true,body:'SECRET LETTER',title:'Our anniversary',unlock_at:future,author:{username:'friend'}};
 const h=harness({'get_chat_connections':[],'feed':()=>[sealed]});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Time Capsules').click();await h.flush();
 assert.doesNotMatch(h.doc.getElementById('social').textContent,/SECRET LETTER/);
 assert.equal([...h.doc.querySelectorAll('.luo-social-capsule button')].filter(b=>b.textContent==='Open letter').length,0);
});

test('Closing the social interface on signout removes private rendered content',async()=>{
 const h=harness({'feed':[{id:'one',kind:'post',body:'Private',author:{username:'friend'}}]});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 assert.match(h.doc.querySelector('#social').textContent,/Private/);
 h.setOwner(null);h.hub.signedOut();
 assert.doesNotMatch(h.doc.querySelector('.luo-social-content').textContent,/Private/);
});
