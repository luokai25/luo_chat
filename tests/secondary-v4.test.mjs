import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {installConnections} from '../src/connections.js';

const css=await readFile('public/luo-secondary-v4.css','utf8');
const home=await readFile('public/index.html','utf8');
function fixture(){
 const dom=new JSDOM('<div class="app"><div id="new"></div><div id="settings-profile"></div><strong id="roomtitle"></strong><div id="roomavatar"></div><button id="manageGroup"></button><button id="caller">Open</button></div>',{url:'https://luo-chat-luokai25.vercel.app',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.confirm=()=>true;
 const writes=[];Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>writes.push(text)}});
 let error=false,calls=[];
 const getUser=()=>({id:'owner'});
 const db={rpc:async(name,args)=>{calls.push(name);if(error)throw Error('Network issue');if(name==='get_chat_person')return{data:[{id:'guest',username:'agent_friend',display_name:'Guest',bio:'My short bio',relationship:'friends',is_blocked:false}]};return{data:[]}}};
 const api=installConnections({win:w,db,$:id=>d.getElementById(id),getUser,getCurrent:()=>({kind:'direct',person:{id:'guest'}}),note:()=>{},startChat:async()=>{},refreshBlocks:async()=>{},projectUrl:'https://byjixqwpjvsgmqilmzbm.supabase.co'});
 return{dom,w,d,api,writes,calls,setError:x=>error=x,close(){api.signedOut();w.close()}};
}
test('profile secondary screen uses authorized data, real actions, and copies only a public username',async()=>{
 const f=fixture();try{
  f.d.getElementById('caller').focus();
  await f.api.open('guest');
  assert.ok(f.d.querySelector('.luo-profile-cover'));
  assert.equal(f.d.querySelector('.luo-profile-about .person-bio').textContent,'My short bio');
  assert.ok(f.d.querySelector('#personActions button.primary'));
  assert.equal(f.d.querySelector('.luo-profile-about-heading').textContent,'About');
  f.d.querySelector('.luo-profile-copy').click();
  await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(f.writes,['@agent_friend']);
  assert.ok(f.calls.includes('get_chat_person'));
 }finally{f.close()}
});
test('profile loading errors have a working retry that uses the original protected RPC',async()=>{
 const f=fixture();try{
  f.setError(true);await f.api.open('guest');
  assert.match(f.d.getElementById('personStatus').textContent,/Network issue/);
  const retry=f.d.querySelector('.luo-profile-retry');assert.ok(retry);
  f.setError(false);retry.click();
  await new Promise(r=>setTimeout(r,10));
  assert.ok(f.d.querySelector('.luo-profile-about'));
  assert.equal(f.calls.filter(c=>c==='get_chat_person').length,2);
 }finally{f.close()}
});
test('secondary CSS covers exact connected views with mobile safe areas and reduced motion',()=>{
 for(const name of ['#personDialog','#personPhotoDialog','.luo-dm-settings','.luo-feed-comments','#sharedDialog','#mediaViewer','#pollDialog','#scheduleDialog'])assert.ok(css.includes(name),name);
 assert.match(css,/env\(safe-area-inset-bottom/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.luo-profile-cover/);
 assert.match(home,/\/luo-secondary-v4\.css/);
 assert.ok(!css.includes('https://')); // private media must not be hard-coded in CSS
});
test('new agent verification guide is discoverable without promising paid access',async()=>{
 const html=await readFile('public/agent-verification.html','utf8');
 const guide=await readFile('public/agents.html','utf8');
 const openapi=JSON.parse(await readFile('public/openapi.json','utf8'));
 assert.match(guide,/\/agent-verification/);
 assert.match(html,/Key proof/);
 assert.match(html,/does not reserve a username/);
 assert.match(html,/10-minute|ten minutes|ten-minute/i);
 for(const url of ['agents/verification','agents/verification/start','agents/verification/finish','agents/verification/status']){
  assert.ok(openapi.paths['/api/v1/'+url]);
 }
 assert.match(html,/agent-private\.pem/);
 assert.ok(!html.includes('type="password"')); // no harvesting agent credentials on a static page
});

test('profile activation closes stale chat-detail modal that could intercept Close',async()=>{
 const f=fixture();try{
  const stale=f.d.createElement('dialog');stale.className='luo-dm-settings';f.d.body.append(stale);
  stale.showModal();assert.equal(stale.open,true);
  await f.api.open('guest');
  assert.equal(stale.open,false);
  assert.equal(f.d.getElementById('personDialog').open,true);
 }finally{f.close()}
});
