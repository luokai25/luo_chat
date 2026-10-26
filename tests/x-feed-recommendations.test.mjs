import test from 'node:test';
import assert from 'node:assert/strict';
import {rankAuthorizedFeed} from '../src/server/x-feed-ranker.js';
import {createForYouHandler} from '../api/for-you.js';
const NOW=Date.parse('2026-10-26T12:00:00Z');
const item=(id,other={})=>({id,owner_id:'author-'+id,kind:'post',audience:'public',published:true,created_at:new Date(NOW-60000).toISOString(),reactions:0,comments:0,...other});
const reply=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}});
const db=({user='viewer',safety={age_tier:'18+',enforced:true},posts=[],clips=[],error=null}={})=>({
 auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},
 rpc:async(name,args)=>{
  if(name==='luo_my_age_safety')return{data:safety,error};
  assert.equal(name,'luo_space');assert.equal(args.input.mode,'public');
  return{data:args.input.kind==='post'?posts:clips,error};
 }
});
const run=async(options={},req={})=>{const res=reply();await createForYouHandler(options)({method:'GET',headers:{authorization:'Bearer test'},...req},res);return res};
test('private, unpublished, future or duplicate entries are filtered',()=>{
 const rows=[item('a'),item('b',{audience:'friends',reactions:100}),item('c',{published:false}),item('d',{created_at:new Date(NOW+1e7).toISOString()}),item('a')];
 assert.deepEqual(rankAuthorizedFeed(rows,{now:NOW}).map(x=>x.id),['a']);
});
test('ranking diversifies authors with stable order',()=>{
 const rows=[item('a'),item('b',{owner_id:'author-a',reactions:100}),item('c',{owner_id:'author-a',reactions:50}),item('d',{owner_id:'author-b',comments:10})];
 assert.deepEqual(rankAuthorizedFeed(rows,{now:NOW,perAuthor:1}).map(x=>x.id),['b','d']);
});
test('disabled by default without a backend read',async()=>{
 let calls=0;const res=await run({enabled:()=>false,makeClient:()=>{calls++}});
 assert.equal(res.code,503);assert.equal(calls,0);assert.match(res.headers['Cache-Control'],/no-store/);
});
test('GET only, bearer required, session validated',async()=>{
 const handler=createForYouHandler({enabled:()=>true,makeClient:async()=>db()});
 let res=reply();await handler({method:'POST',headers:{authorization:'Bearer test'}},res);assert.equal(res.code,405);
 res=reply();await handler({method:'GET',headers:{}},res);assert.equal(res.code,401);
 res=await run({enabled:()=>true,makeClient:async()=>db({user:null})});assert.equal(res.code,401);
});
test('server age safety must be active, with assured tier',async()=>{
 for(const safety of [{age_tier:'unknown',enforced:true},{age_tier:'18+',enforced:false},null]){
  const res=await run({enabled:()=>true,makeClient:async()=>db({safety})});assert.equal(res.code,503);
 }
});
test('only public user-authorized posts and clips are ranked',async()=>{
 const res=await run({enabled:()=>true,clock:()=>NOW,makeClient:async()=>db({
  posts:[item('p'),item('private',{audience:'private',reactions:100})],
  clips:[item('v',{kind:'clip',comments:10})],
  safety:{age_tier:'15-17',enforced:true}
 })},{query:{limit:'2'}});
 assert.equal(res.code,200);assert.deepEqual(res.body.items.map(x=>x.id),['v','p']);
 assert.equal(res.body.ranker,'luo-local-v1');
});
test('backend secrets never reach error response',async()=>{
 const res=await run({enabled:()=>true,makeClient:async()=>{throw Error('SUPER SECRET')}});
 assert.equal(res.code,503);assert.doesNotMatch(JSON.stringify(res.body),/SECRET/);
});
