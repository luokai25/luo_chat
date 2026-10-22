import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {parseSearch} from '../src/search.js';
import {installOutbox} from '../src/outbox.js';
import {findSilences,encodeWav} from '../src/media.js';
import {installTranslation} from '../src/translation.js';

test('search filters preserve quoted text, validate UTC calendar days and reject reversed ranges',()=>{
 const q=parseSearch('"project launch" from:@alice type:pdf after:2026-01-01 before:2026-12-01');
 assert.equal(q.search_text,'project launch');assert.equal(q.sender_username,'alice');assert.equal(q.content_type,'pdf');assert.equal(q.after_date,'2026-01-01T00:00:00.000Z');
 for(const text of ['before:2026-02-30','after:2026-12-01 before:2026-01-01','type:exe',''])assert.throws(()=>parseSearch(text));
});
function queue(send){const dom=new JSDOM('',{url:'https://example.org'});let user={id:'a'};const errors=[];const box=installOutbox({win:dom.window,getUser:()=>user,send,onError:e=>errors.push(e.message)});return{box,win:dom.window,setUser:id=>user={id},errors,close(){box.dispose();dom.window.close()}}}
const item=n=>({operation:'op-'+n,conversation_id:'room',body:'Message '+n});
test('offline queue retains failed messages and retries the identical operation',async()=>{let attempts=0;const sent=[];const q=queue(async(row,owner)=>{sent.push([row.operation,owner]);if(++attempts===1)throw Error('network lost');return {id:'server-id'}});try{q.box.enqueue(item(1));await q.box.flush();assert.equal(q.box.list().length,1);assert.equal(q.box.list()[0].error,'network lost');await q.box.flush();assert.equal(q.box.list().length,0);assert.deepEqual(sent,[['op-1','a'],['op-1','a']])}finally{q.close()}});
test('queue is account-scoped and stops after an account switch during a send',async()=>{let q;const sent=[];q=queue(async row=>{sent.push(row.operation);q.setUser('b')});try{q.box.enqueue(item(1));q.box.enqueue(item(2));await q.box.flush();assert.deepEqual(sent,['op-1']);assert.equal(q.box.list().length,0);q.setUser('a');assert.equal(q.box.list().length,2)}finally{q.close()}});
test('cancel cannot retract an in-flight send and cancels unsent snapshot entries',async()=>{let q;q=queue(async row=>{assert.throws(()=>q.box.cancel(row.operation),/already sending/);q.box.cancel('op-2')});try{q.box.enqueue(item(1));q.box.enqueue(item(2));await q.box.flush();assert.deepEqual(q.box.list(),[])}finally{q.close()}});
test('corrupt outbox does not produce unhandled background rejection or overwrite data',async()=>{const q=queue(async()=>{});try{q.win.localStorage.setItem('luo-chat-outbox-v1-a','broken');await q.box.flush();assert.equal(q.errors.length,1);assert.throws(()=>q.box.enqueue(item(1)),/could not be read/);assert.equal(q.win.localStorage.getItem('luo-chat-outbox-v1-a'),'broken')}finally{q.close()}});
test('silence detection excludes short pauses and preserves trailing silence',()=>{const rate=1000,samples=new Float32Array(2000).fill(.5);samples.fill(0,200,800);samples.fill(0,1000,1200);samples.fill(0,1500);assert.deepEqual(findSilences(samples,rate),[[.2,.8],[1.5,2]])});
test('WAV clips have exact frame lengths, signed samples and bounds validation',()=>{const buffer={sampleRate:4,duration:1,numberOfChannels:1,getChannelData:()=>new Float32Array([-1,0,.5,1])};const data=encodeWav(buffer,.25,1),v=new DataView(data);assert.equal(data.byteLength,50);assert.equal(v.getUint32(40,true),6);assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(48,true),32767);assert.throws(()=>encodeWav(buffer,-1,1));assert.throws(()=>encodeWav(buffer,1,1))});
test('translation requires browser support and explicit model preparation',async()=>{await assert.rejects(installTranslation({}).translate('hi','en','ar'),/unavailable/);let created=0,destroyed=0;const translator=installTranslation({Translator:{availability:async()=> 'downloadable',create:async()=>{created++;return{translate:async t=>'translated:'+t,destroy:()=>destroyed++}}}});await assert.rejects(translator.translate('hi','en','ar'),/Prepare/);await translator.prepare('en','ar',{download:true});assert.equal(await translator.translate('hi','en','ar'),'translated:hi');assert.equal(created,1);translator.clear();assert.equal(destroyed,1)});
