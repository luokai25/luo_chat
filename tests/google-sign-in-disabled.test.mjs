import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installGoogleSignIn} from '../src/google-sign-in.js';

test('username-only Android screen starts with no removed OAuth fields and does not request Google',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><div id="auth"></div></body></html>',{url:'https://luo-chat-luokai25.vercel.app/',pretendToBeVisual:true});
 let fetched=0,oauthCalls=0;
 const win=dom.window;
 win.fetch=async()=>{fetched++;throw Error('Google settings must not be fetched.')};
 const db={auth:{signInWithOAuth:async()=>{oauthCalls++;throw Error('OAuth disabled')}}};
 try{
  const control=installGoogleSignIn({win,db,$:id=>win.document.getElementById(id),projectUrl:'https://byjixqwpjvsgmqilmzbm.supabase.co',publicKey:'anon'});
  assert.equal(typeof control.reset,'function');
  assert.equal(typeof control.sessionReady,'function');
  assert.equal(typeof control.dispose,'function');
  control.sessionReady();control.reset();control.dispose();
  assert.equal(fetched,0);
  assert.equal(oauthCalls,0);
 }finally{dom.window.close()}
});
