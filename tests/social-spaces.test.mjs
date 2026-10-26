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
 const h=harness({'feed':[{kind:'clip',id:'abc',owner_id:'friend',published:true,audience:'public',media:[],author:{username:'friend'},body:'<img src=x onerror=alert(1)>',reactions:0,comments:0}]});
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
 const h=harness({'feed':[{id:'one',kind:'clip',owner_id:'friend',published:true,audience:'public',media:[],body:'Private',author:{username:'friend'}}]});
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


test('Interest recommendations require explicit public tag visibility as well as opt-in',async()=>{
 const h=harness({'profile.get':{interests:['anime'],discoverable:false,sections:{tags:'friends',music:'friends'},music:'',presence:'online',grid:'classic'}});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='My interests').click();await h.flush();
 const form=h.doc.querySelector('#social form');
 assert.ok(form);
 form.querySelector('input[type=checkbox]').checked=true;
 form.dispatchEvent(new h.window.Event('submit',{cancelable:true,bubbles:true}));
 await h.flush();
 assert.match(h.doc.querySelector('.luo-social-status').textContent,/Public interest tags are required/);
 assert.equal(h.requests.filter(c=>c.action==='profile.save').length,0);
 form.querySelectorAll('select')[0].value='public';
 form.dispatchEvent(new h.window.Event('submit',{cancelable:true,bubbles:true}));
 await h.flush();
 const saved=h.requests.find(c=>c.action==='profile.save');
 assert.equal(saved.input.discoverable,true);
 assert.equal(saved.input.sections.tags,'public');
 h.window.close();
});


test('Unlocked Time Capsule visibly unfolds its envelope before revealing letter and handles closing',async()=>{
 const h=harness({'get_chat_connections':[],'feed':[{kind:'capsule',id:'capsule-one',locked:false,title:'A golden surprise',body:'Just for you',unlock_at:new Date(Date.now()-60000).toISOString(),author:{username:'friend'}}]});
 h.window.matchMedia=()=>({matches:false});
 const proto=h.window.HTMLDialogElement.prototype;
 proto.showModal=function(){this.setAttribute('open','');};
 proto.close=function(){this.removeAttribute('open');};
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Time Capsules').click();await h.flush();
 const open=[...h.doc.querySelectorAll('.luo-social-capsule button')].find(b=>b.textContent==='Open letter');assert.ok(open);
 open.click();await h.flush();
 const modal=h.doc.querySelector('.luo-capsule-dialog');assert.ok(modal.open);
 const unfold=[...modal.querySelectorAll('button')].find(b=>b.textContent==='Unfold letter');assert.ok(unfold);
 unfold.click();
 assert.ok(modal.querySelector('.luo-capsule-envelope.luo-capsule-unsealing'));
 assert.equal(modal.querySelector('.luo-capsule-letter'),null);
 await new Promise(resolve=>setTimeout(resolve,730));
 assert.equal(modal.querySelector('.luo-capsule-letter p').textContent,'Just for you');
 assert.equal(modal.querySelectorAll('.luo-capsule-release-particle').length,0);
 h.window.close();
});


test('Rejected capsule attachments never create an orphan server-side draft',async()=>{
 const friend='30000000-0000-4000-8000-000000000003';
 const h=harness({'get_chat_connections':[{id:friend,username:'friend',display_name:'Friend'}],'feed':[]});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Time Capsules').click();await h.flush();
 const form=h.doc.querySelector('#social form');assert.ok(form);
 form.querySelector('select').value=friend;
 form.querySelector('textarea').value='For your birthday';
 const future=new Date(Date.now()+86400000),local=new Date(future.getTime()-future.getTimezoneOffset()*60000);
 form.querySelector('input[type=datetime-local]').value=local.toISOString().slice(0,16);
 Object.defineProperty(form.querySelector('input[type=file]'),'files',{value:[new h.window.File(['bad payload'],'danger.exe',{type:'application/octet-stream'})]});
 form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
 await h.flush();
 assert.equal(h.requests.filter(r=>r.action==='entry.create').length,0);
 assert.match(h.doc.querySelector('.luo-social-status').textContent,/supported photos or audio/);
 h.window.close();
});


test('Interactive question reveals a decorated safe answer only after server confirmation and prevents duplicate votes',async()=>{
 const h=harness({'feed':[{id:'q1',kind:'question',body:'Which surprise?',data:{choices:[{label:'Moon',followup:'Moonlight'},{label:'Stars',followup:'Starlight'}]}}],'response':{followup:'<img src=x onerror=alert(1)> A golden surprise'}});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 [...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Questions').click();await h.flush();
 const pick=[...h.doc.querySelectorAll('#social button')].find(b=>b.textContent==='Moon');
 assert.ok(pick);
 pick.click();await h.flush();
 const reveal=h.doc.querySelector('.luo-question-reveal');
 assert.ok(reveal);
 assert.match(reveal.textContent,/golden surprise/);
 assert.equal(reveal.querySelector('img'),null);
 assert.equal(reveal.getAttribute('role'),'status');
 assert.equal(pick.disabled,true,'answered question cannot be activated again');
 pick.click();await h.flush();
 assert.equal(h.requests.filter(r=>r.action==='response').length,1);
 h.window.close();
});


test('Social Worlds shortcut routes to dedicated Worlds without duplicating community controls',async()=>{
 const h=harness({'feed':[]});
 h.doc.querySelector('[data-tab="social"]').click();await h.flush();
 const shortcut=[...h.doc.querySelectorAll('.luo-social-chip')].find(b=>b.textContent==='Worlds');assert.ok(shortcut);
 shortcut.click();await h.flush();
 assert.equal(h.doc.querySelector('.app').dataset.tab,'group');
 assert.equal(h.doc.querySelector('.luo-community-mod'),null);
 h.window.close();
});

test('photo posts upload validated images before publishing and return to the feed',async()=>{
 const h=harness({'feed':[]});
 try{
  h.doc.querySelector('[data-tab="social"]').click();await h.flush();
  h.doc.querySelector('[data-section="compose"]').click();await h.flush();
  const f=h.doc.querySelector('#social form'),photo=new h.window.File(['photo'],'gold.png',{type:'image/png'});
  Object.defineProperty(f.querySelector('input[type=file]'),'files',{value:[photo]});
  f.dispatchEvent(new h.window.Event('submit',{cancelable:true,bubbles:true}));await h.flush();
  const created=h.requests.findIndex(x=>x.action==='entry.create'),uploaded=h.requests.findIndex(x=>x.name==='upload'),published=h.requests.findIndex(x=>x.action==='entry.publish');
  assert.ok(created>=0&&created<uploaded&&uploaded<published);
  assert.equal(h.requests[published].input.media.length,1);
  assert.match(h.requests[published].input.media[0].path,/\.png$/);
  assert.equal(h.doc.querySelector('[data-section="feed"]').getAttribute('aria-pressed'),'true');
 }finally{h.window.close()}
});

test('invalid photo files are rejected before creating a post draft',async()=>{
 const h=harness({'feed':[]});try{
  h.doc.querySelector('[data-tab="social"]').click();await h.flush();h.doc.querySelector('[data-section="compose"]').click();await h.flush();
  const f=h.doc.querySelector('#social form');Object.defineProperty(f.querySelector('input[type=file]'),'files',{value:[new h.window.File(['bad'],'bad.svg',{type:'image/svg+xml'})]});
  f.dispatchEvent(new h.window.Event('submit',{cancelable:true,bubbles:true}));await h.flush();
  assert.equal(h.requests.filter(x=>x.action==='entry.create').length,0);assert.match(h.doc.querySelector('.luo-social-status').textContent,/six JPG, PNG or WebP/);
 }finally{h.window.close()}
});

test('real tab callbacks load Social once and leaving invalidates pending results',async()=>{
 const dom=new JSDOM('<div class="app" data-tab="chats"><nav class="workspace-nav"></nav><div><section id="chats"></section></div></div>',{url:'https://luo.example'}),w=dom.window,d=w.document;
 let hub;const calls=[];hub=installSocialSpaces({win:w,db:{rpc:async(name,args)=>{calls.push(args);return{data:[]}}},$:id=>d.getElementById(id),getUser:()=>({id:'me'}),getChats:()=>[],note:()=>{},tab:key=>{d.querySelector('.app').dataset.tab=key;hub.onTab(key)}});
 try{d.querySelector('[data-tab="social"]').click();await new Promise(r=>setImmediate(r));assert.equal(calls.filter(x=>x.action==='feed').length,4,'Luonix requests public and friends clips plus written/photo posts without duplicate items');hub.onTab('chats');assert.equal(d.querySelector('.luo-feed'),null)}finally{w.close()}
});
