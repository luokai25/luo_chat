import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderMemoryConstellations} from '../src/memory-constellations.js';

test('Shared history is loaded through authorization-aware RPC and renders memories as inert text',async()=>{
 const dom=new JSDOM('<div id="out"></div>',{url:'https://luo.example'}),w=dom.window,d=w.document,actor={id:'10000000-0000-4000-8000-000000000001'};
 const cid='30000000-0000-4000-8000-000000000003',calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:[{id:'40000000-0000-4000-8000-000000000004',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-23T03:00:00Z',special_count:2}]}}};
 const stop=renderMemoryConstellations({win:w,db,note:()=>{},getUser:()=>actor,getChats:()=>[{id:cid,title:'Shared conversation'}],output:d.getElementById('out')});
 const select=d.querySelector('select');select.value=cid;
 d.querySelector('.luo-social-card .primary').click();
 await new Promise(r=>setTimeout(r,15));
 assert.equal(calls[0].args.action,'memories');
 assert.equal(calls[0].args.input.room_id,cid);
 assert.equal(d.querySelectorAll('.luo-memory-star').length,1);
 d.querySelector('.luo-memory-star').click();
 assert.match(d.querySelector('.luo-memory-detail').textContent,/onerror=alert/);
 assert.equal(d.querySelectorAll('.luo-memory-detail img').length,0);
 stop();w.close();
});

test('Denied shared timeline never renders unauthorized memories',async()=>{
 const dom=new JSDOM('<div id="out"></div>',{url:'https://luo.example'}),w=dom.window,d=w.document;
 const db={rpc:async()=>({error:{message:'Both friends must enable their shared timeline first'}})};
 const stop=renderMemoryConstellations({win:w,db,note:()=>{},getUser:()=>({id:'me'}),getChats:()=>[{id:'room',title:'Room'}],output:d.getElementById('out')});
 d.querySelector('select').value='room';
 d.querySelector('button.primary').click();
 await new Promise(r=>setTimeout(r,15));
 assert.equal(d.querySelectorAll('.luo-memory-star').length,0);
 assert.match(d.querySelector('.muted').textContent,/Explore|Both friends/);
 stop();w.close();
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function memoryHarness(rpc){
 const dom=new JSDOM('<div id="out"></div>',{url:'https://luo.example'}),w=dom.window,d=w.document;
 let actor={id:'first-user'};
 const calls=[];
 const stop=renderMemoryConstellations({win:w,db:{rpc:async(name,args)=>{calls.push(args);return rpc(args,calls.length)}},note:()=>{},getUser:()=>actor,getChats:()=>[{id:'a',title:'Alice'},{id:'b',title:'Bob'}],output:d.getElementById('out')});
 const select=d.querySelector('select'),explore=d.querySelector('button.primary');
 const choose=id=>{select.value=id;select.dispatchEvent(new w.Event('change'))};
 return {w,d,stop,calls,choose,explore,setActor:value=>{actor=value},close:()=>{stop();w.close()}};
}
const memory={id:'memory-1',body:'Private Alice memory',created_at:'2026-10-23T03:00:00Z',special_count:1};

test('changing conversation cancels the loading state and discards the previous response',async()=>{
 const first=deferred(),second=deferred();
 const h=memoryHarness(args=>args.input.room_id==='a'?first.promise:second.promise);
 try{
  h.choose('a');h.explore.click();assert.equal(h.explore.disabled,true);
  h.choose('b');assert.equal(h.explore.disabled,false);h.explore.click();
  first.resolve({data:[memory]});await settle();
  assert.equal(h.d.querySelectorAll('.luo-memory-star').length,0);
  assert.equal(h.explore.disabled,true,'old request must not unlock the new request');
  second.resolve({data:[{...memory,body:'Bob memory'}]});await settle();
  assert.equal(h.explore.disabled,false);
  h.d.querySelector('.luo-memory-star').click();
  assert.match(h.d.querySelector('.luo-memory-detail').textContent,/Bob memory/);
  assert.doesNotMatch(h.d.body.textContent,/Private Alice/);
 }finally{h.close()}
});

test('refresh clears private memories immediately before rechecking server authorization',async()=>{
 const refresh=deferred();const h=memoryHarness((args,count)=>count===1?{data:[memory]}:refresh.promise);
 try{
  h.choose('a');h.explore.click();await settle();h.d.querySelector('.luo-memory-star').click();
  assert.match(h.d.body.textContent,/Private Alice/);
  h.explore.click();
  assert.equal(h.d.querySelectorAll('.luo-memory-star').length,0);
  assert.equal(h.d.querySelector('.luo-memory-detail').textContent,'');
  refresh.resolve({error:{message:'Shared timeline consent withdrawn'}});await settle();
  assert.match(h.d.body.textContent,/consent withdrawn/);
  assert.doesNotMatch(h.d.body.textContent,/Private Alice/);
  assert.equal(h.explore.disabled,false);
  assert.equal(h.d.querySelector('[aria-busy]').getAttribute('aria-busy'),'false');
 }finally{h.close()}
});

test('detached star and mark buttons cannot act after changing conversations',async()=>{
 const h=memoryHarness(()=>({data:[memory]}));
 try{
  h.choose('a');h.explore.click();await settle();
  const star=h.d.querySelector('.luo-memory-star');star.click();
  const mark=h.d.querySelector('.luo-memory-detail button');
  h.choose('b');star.click();mark.click();await settle();
  assert.equal(h.calls.length,1,'no write RPC from an obsolete memory');
  assert.equal(h.d.querySelector('.luo-memory-detail').textContent,'');
 }finally{h.close()}
});

test('account changes discard pending history and disable old memory actions',async()=>{
 const pending=deferred();const h=memoryHarness((args,count)=>count===1?{data:[memory]}:pending.promise);
 try{
  h.choose('a');h.explore.click();await settle();
  const star=h.d.querySelector('.luo-memory-star');star.click();
  const mark=h.d.querySelector('.luo-memory-detail button');
  h.explore.click();h.setActor({id:'second-user'});star.click();mark.click();
  pending.resolve({data:[memory]});await settle();
  assert.equal(h.calls.length,2);
  assert.equal(h.d.querySelectorAll('.luo-memory-star').length,0);
  assert.equal(h.d.querySelector('.luo-memory-detail').textContent,'');
 }finally{h.close()}
});

test('leaving the view invalidates requests and prevents detached controls from reloading',async()=>{
 const pending=deferred();const h=memoryHarness(()=>pending.promise);
 try{
  h.choose('a');h.explore.click();h.stop();
  pending.resolve({data:[memory]});await settle();h.explore.click();
  assert.equal(h.calls.length,1);
  assert.equal(h.d.querySelectorAll('.luo-memory-star').length,0);
  assert.equal(h.explore.disabled,true);
 }finally{h.close()}
});

test('repeated clicks submit one special mark and stale completion never reloads another room',async()=>{
 const pending=deferred();const h=memoryHarness(args=>args.action==='memory.special'?pending.promise:{data:[memory]});
 try{
  h.choose('a');h.explore.click();await settle();h.d.querySelector('.luo-memory-star').click();
  const mark=h.d.querySelector('.luo-memory-detail button');mark.click();mark.click();
  assert.equal(h.calls.filter(x=>x.action==='memory.special').length,1);
  h.choose('b');pending.resolve({data:{ok:true}});await settle();
  assert.equal(h.calls.length,2,'old write completion must not load the newly selected conversation');
 }finally{h.close()}
});
