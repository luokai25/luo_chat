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
 const db={storage:{from:bucket=>({upload:async(path,file)=>{requests.push({name:'upload',bucket,path,type:file.type});return {data:{path},error:null}},createSignedUrl:async()=>({error:{message:'Not available'}})})},rpc:async(name,args)=>{requests.push({name,...args});const response=responses[args.action||name];if(response instanceof Error)return{error:{message:response.message}};return{data:typeof response==='function'?response(args.input):response||[]}}};
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


test('Time Capsules publish only after the selected private attachment uploads',async()=>{
 const friend='30000000-0000-4000-8000-000000000003';
 const h=harness({'get_chat_connections':[{id:friend,username:'friend',display_name:'Friend'}],'feed':[]});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Time Capsules').click();await h.flush();
 const form=h.doc.querySelector('#social form');
 assert.ok(form);
 form.querySelector('select').value=friend;
 form.querySelector('input[type=text]').value='Birthday surprise';
 form.querySelector('textarea').value='Open this on your birthday';
 const future=new Date(Date.now()+86400000),adjusted=new Date(future.getTime()-future.getTimezoneOffset()*60000);
 form.querySelector('input[type=datetime-local]').value=adjusted.toISOString().slice(0,16);
 const file=new h.window.File(['fake photo bytes'],'photo.png',{type:'image/png'});
 Object.defineProperty(form.querySelector('input[type=file]'),'files',{value:[file]});
 form.dispatchEvent(new h.window.Event('submit',{cancelable:true,bubbles:true}));
 await h.flush();
 const create=h.requests.findIndex(r=>r.action==='entry.create'),upload=h.requests.findIndex(r=>r.name==='upload'),publish=h.requests.findIndex(r=>r.action==='entry.publish');
 assert.ok(create>=0,'capsule created');
 assert.ok(upload>create,'attachment uploaded after creating private draft');
 assert.ok(publish>upload,'only published after upload succeeds');
 assert.equal(h.requests[publish].input.media[0].path,h.requests[upload].path);
 assert.equal(h.requests[upload].bucket,'luo-social');
 h.window.close();
});

test('Notification controls use account-scoped RPC and save explicit categories',async()=>{
 const h=harness({'preferences.get':{messages:true,capsules:false},'preferences.save':{}});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Alerts').click();await h.flush();
 assert.equal(h.doc.querySelectorAll('.luo-social-setting input[type=checkbox]').length,10);
 const save=[...h.doc.querySelectorAll('#social button')].find(b=>b.textContent==='Save notification categories');
 save.click();await h.flush();
 const written=h.requests.find(r=>r.action==='preferences.save');
 assert.ok(written);
 assert.equal(written.input.categories.capsules,false);
 assert.equal(written.input.categories.messages,true);
 h.window.close();
});
