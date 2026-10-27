import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../src/enhancements.js',import.meta.url),'utf8');
const begin=source.indexOf('async function showScheduled(){');
const end=source.indexOf("\n $('refreshScheduled').onclick=showScheduled;",begin);
assert.ok(begin>=0&&end>begin,'scheduled renderer is present');
const functionCode=source.slice(begin,end);

// Execute only the scheduled renderer with a controlled database fixture.
// No Supabase connection, real accounts, or synthetic billing occurs.
function harness(){
 const dom=new JSDOM('<div id="scheduledList"></div>'),d=dom.window.document;
 const pending=[];let actor={id:'accountA'};
 const db={from:table=>{assert.equal(table,'scheduled_messages');const q={
  select(){return q},eq(){return q},order(){return q},
  limit(){return new Promise(resolve=>pending.push(resolve))}
 };return q}};
 const api=new Function('getUser','$','db','unwrap','doc','button','rpc','getChats','openRoom','formatTime','note',
  'let scheduledViewRequest=0;'+functionCode+';return {showScheduled, invalidate:()=>scheduledViewRequest++};')(
  ()=>actor,id=>d.getElementById(id),db,r=>{if(r.error)throw r.error;return r.data},d,
  ()=>{throw Error('Unexpected action')},()=>{},()=>[],()=>{},value=>String(value),()=>{}
 );
 const result=(text)=>({data:[{id:text,conversation_id:'conversation',body:text,send_at:'2030-04-01T12:00:00Z',status:'sent',error_text:null}],error:null});
 return {api,pending,result,list:d.getElementById('scheduledList'),setActor:v=>actor=v,close:()=>dom.window.close()};
}

test('out-of-order schedule replies cannot overwrite the newest list',async()=>{
 const x=harness();try{
  const older=x.api.showScheduled(),newer=x.api.showScheduled();
  assert.equal(x.pending.length,2);
  x.pending[1](x.result('Newest message'));await newer;
  assert.match(x.list.textContent,/Newest message/);
  x.pending[0](x.result('Stale message'));await older;
  assert.match(x.list.textContent,/Newest message/);
  assert.doesNotMatch(x.list.textContent,/Stale message/);
 }finally{x.close()}
});

test('sign-out invalidates pending schedule refresh results',async()=>{
 const x=harness();try{
  const pending=x.api.showScheduled();
  x.api.invalidate();x.setActor(null);x.list.replaceChildren();
  x.pending[0](x.result('Belongs to signed-out account'));await pending;
  assert.equal(x.list.childElementCount,0);
  assert.equal(x.list.textContent,'');
 }finally{x.close()}
});

test('an older failed request cannot replace the latest successful history',async()=>{
 const x=harness();try{
  const older=x.api.showScheduled(),newer=x.api.showScheduled();
  x.pending[1](x.result('Current saved schedule'));await newer;
  x.pending[0]({data:null,error:{message:'Offline'}});await older;
  assert.match(x.list.textContent,/Current saved schedule/);
  assert.doesNotMatch(x.list.textContent,/Offline/);
 }finally{x.close()}
});
