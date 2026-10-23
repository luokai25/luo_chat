import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installAuthCapabilities} from '../src/auth-capabilities.js';

function env(check){
 const dom=new JSDOM('<!doctype html><html><body><p id="loginMethodNote"></p><button id="authModeSignup">Create account</button><button id="signup">Sign up</button><button id="forgot">Forgot password</button></body></html>',{
  url:'https://luo-chat-luokai25.vercel.app/',pretendToBeVisual:true
 });
 const win=dom.window,document=win.document,called={signup:0,submit:0,recovery:0};
 const btns=[['authModeSignup','signup'],['signup','submit'],['forgot','recovery']];
 for(const[id,key]of btns){document.getElementById(id).onclick=()=>called[key]++}
 const api=installAuthCapabilities({win,check});
 const click=id=>document.getElementById(id).click();
 const notice=()=>document.getElementById('luoAuthCapabilitiesStatus').textContent;
 return{dom,api,called,click,notice};
}
test('existing users keep username login while unavailable registration fails closed',async()=>{
 const h=env(async()=>({ok:true,username_signin:true,username_signup:false,username_recovery:false}));
 try{
  assert.equal(await h.api.ready(),false);
  h.click('authModeSignup');h.click('signup');h.click('forgot');
  assert.deepEqual(h.called,{signup:0,submit:0,recovery:0});
  assert.match(h.notice(),/recovery is not enabled/);
 }finally{h.api.dispose();h.dom.window.close()}
});
test('fully upgraded backend enables actual registration and recovery UI',async()=>{
 const h=env(async()=>({ok:true,username_signin:true,username_signup:true,username_recovery:true}));
 try{
  assert.equal(await h.api.ready(),true);
  h.click('authModeSignup');h.click('signup');h.click('forgot');
  assert.deepEqual(h.called,{signup:1,submit:1,recovery:1});
  assert.equal(await h.api.ensureSignup(),true);
  assert.equal(h.api.supportsRecovery(),true);
 }finally{h.api.dispose();h.dom.window.close()}
});
test('malformed or unreachable backend never authorizes registration',async()=>{
 for(const answer of [{username_signup:true,username_recovery:false},{username_signup:'true',username_recovery:true},null]){
  const h=env(async()=>answer);
  try{
   assert.equal(await h.api.ready(),false);
   h.click('signup');
   assert.equal(h.called.submit,0);
  }finally{h.api.dispose();h.dom.window.close()}
 }
 const h=env(async()=>{throw new Error('Network down')});
 try{
  assert.equal(await h.api.ready(),false);
  assert.match(h.notice(),/could not be checked/);
  h.click('authModeSignup');assert.equal(h.called.signup,0);
 }finally{h.api.dispose();h.dom.window.close()}
});
test('missing login controls do not crash restoration on a signed-in page',async()=>{
 const dom=new JSDOM('<html><body></body></html>');
 try{
  const api=installAuthCapabilities({win:dom.window,check:async()=>({})});
  assert.equal(await api.ready(),false);
  api.dispose();
 }finally{dom.window.close()}
});
test('capability check does not leak a request to the backend after dispose',async()=>{
 let finish;
 const h=env(()=>new Promise(resolve=>{finish=resolve}));
 const pending=h.api.ready();
 h.api.dispose();
 finish({username_signup:true,username_recovery:true,username_signin:true});
 assert.equal(await pending,false);
 assert.equal(await h.api.ready(),false);
 assert.equal(h.dom.window.document.getElementById('luoAuthCapabilitiesStatus'),null);
 h.dom.window.close();
});
test('backend action must be present and not pretend username-only signup works on compatibility endpoint',async()=>{
 const fs=await import('node:fs/promises');
 const code=await fs.readFile('supabase/functions/luo-auth-compat/index.ts','utf8');
 assert.match(code,/if\(action==='capabilities'\)/);
 assert.match(code,/username_signup:false,username_recovery:false/);
 assert.match(code,/username_signin:true/);
});
