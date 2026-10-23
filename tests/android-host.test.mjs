import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {installAndroidHost} from '../src/android-native.js';
import {installDeviceNotifications} from '../src/device-notifications.js';

function makeApp({bridge=true}={}){
  const dom=new JSDOM('<!doctype html><html><head></head><body>'+
  '<div class="workspace-nav"><button type="button" class="tab active" data-tab="chats">Chats</button><button type="button" class="tab" data-tab="stories">Stories</button></div>'+
  '<section id="room"></section><button type="button" id="back">Back</button><input id="body">'+
  '<button id="enableNotifications">Enable notifications</button><button id="requestNotificationAccess">Allow alerts</button>'+
  '<p id="notificationmsg"></p><p id="access-notifications"></p></body></html>',{
    url:'https://luo-chat-luokai25.vercel.app/',pretendToBeVisual:true
  });
  const win=dom.window;
  win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
  const bridgeCalls=[],texts=[],notes=[],roomIDs=[],messages=[];
  if(bridge)win.LuoAndroid={postMessage:x=>bridgeCalls.push(JSON.parse(x))};
  let user={id:'first-user'};
  const chats=[{id:'room-1',kind:'direct',person:{display_name:'Private Friend'}},{id:'room-2',kind:'group',title:'Coding club'}];
  const host=installAndroidHost({win,getUser:()=>user,getChats:()=>chats,
    openRoom:async id=>{roomIDs.push(id)},roomName:r=>r.person?.display_name||r.title,
    setDraft:txt=>texts.push(txt),note:txt=>notes.push(txt)});
  return {dom,win,host,bridgeCalls,texts,notes,roomIDs,messages,actor:u=>{user=u}};
}
test('sharing from another Android app never sends without a chosen room and explicit Send',async()=>{
 const t=makeApp();
 try{
  t.win.dispatchEvent(new t.win.CustomEvent('luo-android-share',{detail:{text:'Hello <script>alert(1)</script>!'}}));
  const dialog=t.win.document.querySelector('.luo-android-share');
  assert.ok(dialog.open);
  assert.equal(dialog.querySelectorAll('.luo-native-share-room').length,2);
  assert.equal(dialog.querySelector('script'),null);
  assert.match(dialog.textContent,/<script>alert/);
  assert.deepEqual(t.texts,[]);
  dialog.querySelector('.luo-native-share-room').click();
  await new Promise(r=>setTimeout(r,0));
  assert.deepEqual(t.roomIDs,['room-1']);
  assert.deepEqual(t.texts,['Hello <script>alert(1)</script>!']);
  assert.equal(t.win.document.querySelector('.luo-android-share'),null);
  assert.match(t.notes.at(-1),/Review it before sending/);
 }finally{t.host.dispose();t.dom.window.close()}
});
test('queued Android share is scoped to the signed-in user and cleared on signout',async()=>{
 const t=makeApp();
 try{
  t.actor(null);
  t.win.dispatchEvent(new t.win.CustomEvent('luo-android-share',{detail:{text:'A private link'}}));
  assert.equal(t.win.document.querySelector('.luo-android-share'),null);
  assert.deepEqual(t.texts,[]);
  t.actor({id:'first-user'});
  t.host.accountReady();
  assert.ok(t.win.document.querySelector('.luo-android-share'));
  t.host.signedOut();
  assert.equal(t.win.document.querySelector('.luo-android-share'),null);
  t.host.accountReady();
  assert.deepEqual(t.texts,[]);
 }finally{t.host.dispose();t.dom.window.close()}
});
test('native back navigation closes modal, then room, then navigates to Chats without exiting',()=>{
 const t=makeApp();
 try{
  t.win.dispatchEvent(new t.win.CustomEvent('luo-android-share',{detail:{text:'Send later'}}));
  assert.equal(t.win.luoAndroidGoBack(),'handled');
  assert.equal(t.win.document.querySelector('.luo-android-share').open,false);
  t.win.document.getElementById('room').classList.add('active');
  let backCount=0;
  t.win.document.getElementById('back').onclick=()=>{backCount++;t.win.document.getElementById('room').classList.remove('active')};
  assert.equal(t.win.luoAndroidGoBack(),'handled');
  assert.equal(backCount,1);
  const other=t.win.document.querySelector('[data-tab="stories"]'),chats=t.win.document.querySelector('[data-tab="chats"]');
  chats.classList.remove('active');other.classList.add('active');
  chats.onclick=()=>{chats.classList.add('active');other.classList.remove('active')};
  assert.equal(t.win.luoAndroidGoBack(),'handled');
  assert.ok(chats.classList.contains('active'));
  assert.equal(t.win.luoAndroidGoBack(),'exit');
 }finally{t.host.dispose();t.dom.window.close()}
});
test('notification permissions only follow a deliberate settings action and are not requested on startup',()=>{
 const t=makeApp();
 try{
  assert.deepEqual(t.bridgeCalls,[]);
  t.win.document.getElementById('enableNotifications').click();
  assert.deepEqual(t.bridgeCalls,[{type:'notification_permission'}]);
  t.win.dispatchEvent(new t.win.CustomEvent('luo-native-notification-permission',{detail:{granted:true}}));
  assert.match(t.win.document.getElementById('notificationmsg').textContent,/allowed/);
 }finally{t.host.dispose();t.dom.window.close()}
});
test('Android alerts use only generic notification intent and do not expose chat preview to native lock screen',async()=>{
 const t=makeApp();
 try{
  const notifications=installDeviceNotifications({win:t.win});
  await notifications.show({owner:'private-account',title:'Secret chat',options:{body:'Do not show message preview'},isCurrent:()=>true});
  assert.deepEqual(t.bridgeCalls,[{type:'notification'}]);
  notifications.signedOut('private-account');
 }finally{t.host.dispose();t.dom.window.close()}
});
test('Android manifest and bridge enforce first-party HTTPS and required permissions without legacy storage',async()=>{
 const manifest=await readFile('android/app/src/main/AndroidManifest.xml','utf8');
 const java=await readFile('android/app/src/main/java/com/luoscreations/chat/socialtest/LuoNativeFeatures.java','utf8');
 assert.match(manifest,/android.permission.POST_NOTIFICATIONS/);
 assert.match(manifest,/android.intent.action.SEND/);
 assert.match(manifest,/android:configChanges="orientation\|screenSize/);
 assert.doesNotMatch(manifest,/WRITE_EXTERNAL_STORAGE|READ_SMS|READ_CONTACTS/);
 assert.match(java,/WebViewCompat\.addWebMessageListener/);
 assert.match(java,/Collections\.singleton\(ORIGIN\)/);
 assert.match(java,/isMainFrame/);
 assert.match(java,/notification_permission/);
 assert.match(java,/DownloadManager/);
 assert.match(java,/byjixqwpjvsgmqilmzbm\.supabase\.co/);
 assert.doesNotMatch(java,/SUPABASE_SERVICE_ROLE_KEY|cleartext|addJavascriptInterface/);
 assert.match(java,/MIN_NOTIFICATION_INTERVAL_MS/);
 assert.match(java,/MAX_DOWNLOADS_PER_WINDOW/);
 const main=await readFile('android/app/src/main/java/com/luoscreations/chat/socialtest/MainActivity.java','utf8');
 assert.match(main,/onRenderProcessGone/);
 assert.match(main,/renderSafeRecoveryScreen/);
 assert.match(main,/view\.destroy\(\)/);
});
