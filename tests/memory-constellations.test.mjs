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
