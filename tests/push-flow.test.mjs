import test from 'node:test';
import assert from 'node:assert/strict';
import {installWebPush} from '../src/push.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(){
 let actor={id:'a'},sub=null,permission=null,subscribeWait=null,upsertWait=null,deleteError=false,number=0;
 const records=[],notices=[],store=new Map();
 const manager={async getSubscription(){return sub},async subscribe(){if(subscribeWait)await subscribeWait.promise;const value={endpoint:'https://fcm.googleapis.com/'+(++number),toJSON:()=>({keys:{p256dh:'p',auth:'a'}}),async unsubscribe(){records.push(['unsubscribe',value.endpoint]);if(sub===value)sub=null;return true}};sub=value;records.push(['subscribe',value.endpoint]);return value}};
 const registration={pushManager:manager};
 const win={isSecureContext:true,Notification:{requestPermission:()=>permission?.promise||Promise.resolve('granted')},PushManager:function(){},atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},navigator:{serviceWorker:{ready:Promise.resolve(registration),getRegistration:async()=>registration}}};
 const db={rpc:async()=>({data:'AQID'}),from(){const query={delete(){records.push(['delete']);return query},eq(){return query},then(resolve){return Promise.resolve({error:deleteError?{message:'offline'}:null}).then(resolve)},async upsert(row){records.push(['upsert',row.user_id]);if(upsertWait)await upsertWait.promise;return{}}};return query}};
 const api=installWebPush({win,db,getUser:()=>actor,note:s=>notices.push(s)});
 return{api,records,notices,store,getSub:()=>sub,setPermission:d=>permission=d,setSubscribeWait:d=>subscribeWait=d,setUpsertWait:d=>upsertWait=d,setDeleteError:()=>deleteError=true,signOut(){actor=null;api.signedOut()},signIn(id){actor={id};api.accountReady()}};
}
test('Off cancels an Enable still waiting for notification permission',async()=>{const s=setup(),gate=deferred();s.setPermission(gate);const enable=s.api.enable();await s.api.disable();gate.resolve('granted');await enable;assert.equal(s.getSub(),null);assert.equal(s.records.length,0);assert.equal(await s.api.status(),'Off on this device')});
test('Off waits for and removes a subscription created by a superseded Enable',async()=>{const s=setup(),gate=deferred();s.setSubscribeWait(gate);const enable=s.api.enable();await tick();const disable=s.api.disable();gate.resolve();await Promise.all([enable,disable]);assert.equal(s.getSub(),null);assert.equal(s.notices.length,0);assert.equal(await s.api.status(),'Off on this device')});
test('signout during server registration cannot enable old-account notifications',async()=>{const s=setup(),gate=deferred();s.setUpsertWait(gate);const enable=s.api.enable();await tick();s.signOut();gate.resolve();await enable;await tick();assert.equal(s.getSub(),null);assert.equal(s.store.size,0);assert.equal(s.notices.length,0)});
test('old signout cleanup is serialized before a new account subscription',async()=>{const s=setup();await s.api.enable();const old=s.getSub();s.signOut();s.signIn('b');await s.api.enable();assert.ok(s.getSub());assert.notEqual(s.getSub(),old);assert.equal(s.records.filter(r=>r[0]==='subscribe').length,2);assert.equal(s.records.filter(r=>r[0]==='upsert').at(-1)[1],'b');assert.equal(await s.api.status(),'Enabled on this device')});
test('server cleanup failure still stops browser push delivery',async()=>{const s=setup();await s.api.enable();s.setDeleteError();await assert.rejects(s.api.disable(),/Alerts are off in this browser/);assert.equal(s.getSub(),null);assert.equal(s.store.size,0);assert.equal(await s.api.status(),'Off on this device')});
