import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecommendationHandler,recommendationRuntime} from '../src/server/luo-for-you-api.js';
const token='AAA.BBB.CCC',userId='10000000-0000-4000-8000-000000000111';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_RECOMMENDATIONS_ENABLED:'true',LUO_RECOMMENDATIONS_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_RECOMMENDATIONS_STAGING_PUBLISHABLE_KEY:'sb_publishable_dummy_placeholder_123456789'};
function res(){return {statusCode:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
function req(kind='mixed',more={}){return {method:'GET',headers:{authorization:'Bearer '+token,host:'example.vercel.app'},
 query:{kind,view:'for_you'},...more}}
const post={id:'10000000-0000-4000-8000-000000000001',owner_id:'10000000-0000-4000-8000-000000000002',
 kind:'post',audience:'public',published:true,created_at:'2026-10-26T17:00:00Z',body:'Hello Luo',reactions:10,comments:4};
function fakeDb({authBad=false,ctxError=null,socialError=null,age=null}={}){
 const calls=[];
 const db={auth:{getUser:async t=>{calls.push(['getUser',t]);return authBad?{error:{message:'invalid'}}:{data:{user:{id:userId}}}}},
 rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name==='luo_my_age_safety')return {data:age??{age_tier:'18+',enforced:true,content_filter_applied:true}};
  if(name==='luo_recommend_context')return ctxError?{error:{code:ctxError}}:{data:{hidden_ids:[],served_ids:[]}};
  if(name==='luo_space')return socialError?{error:{code:socialError}}:{data:args.input.kind==='post'?[post]:[]};
  if(name==='luo_recommend_mark_served')return {data:args.p_ids.length};
  if(name==='luo_recommend_feedback')return {data:true};
  throw Error('Unexpected rpc '+name)}
 };
 return {db,calls};
}
test('gating prevents the endpoint being enabled outside isolated staging',()=>{
 assert.ok(recommendationRuntime(env));
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},
  {LUO_RECOMMENDATIONS_ENABLED:'false'},
  {LUO_RECOMMENDATIONS_STAGING_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co'}])
  assert.equal(recommendationRuntime({...env,...change}),null);
 const out=res();
 return createRecommendationHandler({env:{...env,VERCEL_ENV:'production'},clientFactory:()=>{throw Error('DB must not be touched')}})(req(),out).then(()=>{
  assert.equal(out.statusCode,503);assert.equal(out.body.error.code,'RECOMMENDATIONS_NOT_ENABLED')});
});
test('rejects missing JWT or forged cross-origin before DB initialization',async()=>{
 let n=0;const handler=createRecommendationHandler({env,clientFactory:()=>{n++;return {}}});
 for(const request of [req('mixed',{headers:{}}),req('mixed',{headers:{...req().headers,origin:'https://evil.example'}})]){
  const out=res();await handler(request,out);assert.ok([401,403].includes(out.statusCode));
 }assert.equal(n,0);
});
test('calls authorized social RPCs, dedupes and records served items with user token only',async()=>{
 const {db,calls}=fakeDb(),out=res();
 await createRecommendationHandler({env,clientFactory:(url,key,options)=>{
  assert.equal(url,env.LUO_RECOMMENDATIONS_STAGING_URL);assert.equal(key,env.LUO_RECOMMENDATIONS_STAGING_PUBLISHABLE_KEY);
  assert.equal(options.global.headers.Authorization,'Bearer '+token);return db}})(req(),out);
 assert.equal(out.statusCode,200);assert.equal(out.body.items.length,1);
 assert.equal(out.body.items[0].id,post.id);
 assert.equal(out.body.items[0].body,'Hello Luo');
 assert.deepEqual(calls.filter(x=>x[0]==='luo_space').map(x=>x[1].input.kind+':'+x[1].input.mode).sort(),
 ['clip:friends','clip:public','post:friends','post:public']);
 assert.deepEqual(calls.find(x=>x[0]==='luo_recommend_mark_served')[1].p_ids,[post.id]);
 assert.equal(out.body.has_more,false);assert.equal(out.body.cursor,null);
});
test('unavailable social service fails closed, no data leaked to clients',async()=>{
 const {db,calls}=fakeDb({socialError:'42883'}),out=res();
 await createRecommendationHandler({env,clientFactory:()=>db,logger:{error(){}}})(req(),out);
 assert.equal(out.statusCode,503);assert.deepEqual(out.body,{error:{code:'RECOMMENDATIONS_SERVICE_UNAVAILABLE'}});
 assert.equal(calls.some(x=>x[0]==='luo_recommend_mark_served'),false);
});
test('private preference feedback is authenticated and strict-input-only',async()=>{
 const {db,calls}=fakeDb(),request=req();
 request.method='POST';request.headers['content-type']='application/json';
 request.body={entry_id:post.id,action:'hide'};
 const out=res();
 await createRecommendationHandler({mode:'feedback',env,clientFactory:()=>db})(request,out);
 assert.equal(out.statusCode,200);
 assert.deepEqual(calls.find(x=>x[0]==='luo_recommend_feedback')[1],{p_entry:post.id,p_action:'hide'});
 const invalid=req();invalid.method='POST';invalid.body={entry_id:post.id,action:'report'};
 invalid.headers['content-type']='application/json';
 const denied=res();await createRecommendationHandler({mode:'feedback',env,clientFactory:()=>db})(invalid,denied);
 assert.equal(denied.statusCode,400);
});
test('authorization failure and exceeded quotas never return a ranked feed',async()=>{
 for(const [config,expected]of [[{authBad:true},401],[{ctxError:'P0001'},429]]){
  const m=fakeDb(config),out=res();
  await createRecommendationHandler({env,clientFactory:()=>m.db})(req(),out);
  assert.equal(out.statusCode,expected);
  assert.equal(m.calls.some(x=>x[0]==='luo_space'),false);
 }
});

test('personalized feed fails closed when verified age/label filtering has not been installed',async()=>{
 for(const age of [{age_tier:'unknown',enforced:false,content_filter_applied:false},
 {age_tier:'13-14',enforced:true,content_filter_applied:false},
 {age_tier:'18+',enforced:false,content_filter_applied:true}]){
  const m=fakeDb({age}),out=res();
  await createRecommendationHandler({env,clientFactory:()=>m.db})(req(),out);
  assert.equal(out.statusCode,503);assert.equal(out.body.error.code,'AGE_SAFETY_NOT_READY');
  assert.equal(m.calls.some(x=>x[0]==='luo_space'),false);
 }
});

test('under-18 feed requires backend-confirmed guardian approval in addition to content labels',async()=>{
 const out=res(),m=fakeDb({age:{age_tier:'15-17',enforced:true,content_filter_applied:true,guardian_approved:false}});
 await createRecommendationHandler({env,clientFactory:()=>m.db})(req(),out);
 assert.equal(out.statusCode,503);assert.equal(out.body.error.code,'AGE_SAFETY_NOT_READY');
 assert.equal(m.calls.some(x=>x[0]==='luo_space'),false);
});

test('pagination replays unserved candidate windows instead of discarding ranked-out posts',async()=>{
 const entries=Array.from({length:20},(_,i)=>({
  ...post,id:'10000000-0000-4000-8000-'+String(i+200).padStart(12,'0'),
  owner_id:'10000000-0000-4000-8000-'+String(i+700).padStart(12,'0'),
  created_at:new Date(Date.parse(post.created_at)-i*1000).toISOString(),
  reactions:100-i,body:'Distinct story '+i
 }));
 const served=new Set(),positions=[];
 const db={auth:{getUser:async()=>({data:{user:{id:userId}}})},
  rpc:async(name,args)=>{
   if(name==='luo_my_age_safety')return{data:{age_tier:'18+',enforced:true,content_filter_applied:true}};
   if(name==='luo_recommend_context')return{data:{hidden_ids:[],served_ids:[...served]}};
   if(name==='luo_space'){
    positions.push(args.input.before_id??null);
    return{data:args.input.kind==='post'&&args.input.mode==='public'?entries:[]};
   }
   if(name==='luo_recommend_mark_served'){
    for(const id of args.p_ids)served.add(id);
    return{data:args.p_ids.length};
   }
   throw Error('Unexpected RPC: '+name);
  }};
 const handler=createRecommendationHandler({env,clientFactory:()=>db});
 const first=res();await handler(req(),first);
 assert.equal(first.statusCode,200);assert.equal(first.body.has_more,true);
 assert.equal(first.body.items.length,20);
 // A source cursor cannot move beyond unread items solely on the first fetch.
 const cursor=JSON.parse(Buffer.from(first.body.cursor,'base64url').toString('utf8'));
 assert.deepEqual(cursor.positions,{});
 // Simulate a ranking page size smaller than its retrieval window by hiding
 // most of the first page's items, leaving them eligible for later exposure.
 for(const id of entries.slice(10).map(x=>x.id))served.delete(id);
 const second=res();await handler(req('mixed',{query:{kind:'mixed',view:'for_you',cursor:first.body.cursor}}),second);
 assert.equal(second.statusCode,200);
 assert.equal(second.body.items.length,10);
 assert.equal(second.body.items.every(x=>!entries.slice(10).every(y=>y.id!==x.id)),true);
 assert.ok(positions.every(pos=>pos===null),'cursor frontier must remain where the unread items exist');
});
test('empty completed source windows return no cursor instead of repeating placeholders',async()=>{
 const m=fakeDb(),db={...m.db,rpc:async(name,args)=>{
  if(name==='luo_space')return{data:[]};
  return m.db.rpc(name,args);
 }};
 const out=res();
 await createRecommendationHandler({env,clientFactory:()=>db})(req(),out);
 assert.equal(out.statusCode,200);
 assert.deepEqual(out.body.items,[]);
 assert.equal(out.body.has_more,false);
 assert.equal(out.body.cursor,null);
});
