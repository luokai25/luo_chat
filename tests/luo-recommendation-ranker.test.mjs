import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 RANKER_VERSION,scoreAuthorizedEntry,rankAuthorizedFeed,feedCursorFromRows
} from '../src/server/luo-recommendation-ranker.js';
import {
 createRecommendationHandler,validateRankingRequest,recommendationEnabled
} from '../api/recommendations.js';

const now=Date.parse('2026-10-26T17:00:00Z');
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const post=(i,more={})=>({
 id:uuid(i),owner_id:uuid(i%2+100),kind:'post',published:true,
 audience:'public',created_at:new Date(now-3600000*i).toISOString(),
 reactions:i%2?4:8,comments:2,media:[],body:'Safe placeholder content',
 ...more
});
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/luonix-x-ranking-20261026',
 SUPABASE_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co',
 SUPABASE_PUBLISHABLE_KEY:'test_publishable_key_which_is_only_a_fixture_012345'};
const token=['abc'.repeat(30),'def'.repeat(30),'ghi'.repeat(30)].join('.');
const request=(body={},other={})=>({
 method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},
 body:{kind:'post',mode:'public',...body},...other
});
const response=()=>({
 headers:{},statusCode:200,body:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(x){this.statusCode=x;return this},
 json(b){this.body=b;return this}
});
function clientFor(rows){
 let captured;
 const clientFactory=(url,key,options)=>{
  captured={url,key,headers:options.global.headers};
  return {auth:{getUser:async(t)=>t===token?{data:{user:{id:uuid(999)}},error:null}:{data:null,error:new Error('bad token')}},
   rpc:async(name,args)=>({data:name==='luo_space'&&args.action==='feed'?rows:null,error:null})};
 };
 return {clientFactory,getCaptured:()=>captured};
}
test('X-based candidate scoring is bounded, deterministic, and favors meaningful quality signals',()=>{
 assert.equal(RANKER_VERSION,'luo-for-you-lite-1');
 const fresh=post(1),old=post(2,{created_at:'2026-09-01T10:00:00Z'});
 assert.ok(scoreAuthorizedEntry(fresh,{now})>scoreAuthorizedEntry(old,{now}));
 assert.ok(scoreAuthorizedEntry(post(1,{comments:8}),{now})>scoreAuthorizedEntry(fresh,{now}));
 assert.ok(Number.isFinite(scoreAuthorizedEntry(post(1,{comments:9999999,reactions:Infinity}),{now})));
});
test('ranking never reintroduces deleted, forbidden, duplicate, or non-public candidates',()=>{
 const c=post(1),rows=[c,{...c},post(2,{published:false}),
  post(3,{audience:'friends'}),post(4,{allowed:false}),
  post(5,{kind:'clip'}),post(6)];
 const ranked=rankAuthorizedFeed(rows,{now,kind:'post',mode:'public'});
 assert.deepEqual(new Set(ranked.map(x=>x.id)),new Set([c.id,post(6).id]));
 assert.ok(ranked.every(x=>x._luo_rank_score!==undefined));
 assert.equal(rows[0]._luo_rank_score,undefined,'Do not mutate authorization-aware backend DTOs');
});
test('fair-share ranking places alternative creators ahead of repetitive posts without dropping one-author content',()=>{
 const a=uuid(100),b=uuid(200);
 const candidates=[post(1,{owner_id:a,reactions:16}),post(2,{owner_id:a,reactions:15}),
  post(3,{owner_id:a,reactions:14}),post(4,{owner_id:b,reactions:9})];
 const ranked=rankAuthorizedFeed(candidates,{kind:'post',mode:'public',now});
 assert.equal(ranked.length,4);
 assert.equal(ranked[0].owner_id,a);
 assert.ok(ranked.slice(0,3).some(x=>x.owner_id===b));
 const one=rankAuthorizedFeed(candidates.map(x=>({...x,owner_id:a})),{kind:'post',mode:'public',now});
 assert.equal(one.length,4,'Small networks should not lose their creator posts');
});
test('pagination anchor uses the oldest time/id in the authorized window, not the last ranked result',()=>{
 const rows=[post(3),post(1),post(2)];
 const c=feedCursorFromRows(rows);
 assert.equal(c.before,post(3).created_at);
 assert.equal(c.before_id,post(3).id);
 assert.equal(feedCursorFromRows([]),null);
});
test('endpoint is preview-gated and production remains disabled without explicit activation',()=>{
 assert.equal(recommendationEnabled({}),false);
 assert.equal(recommendationEnabled(env),true);
 assert.equal(recommendationEnabled({...env,VERCEL_ENV:'production'}),false);
 assert.equal(recommendationEnabled({...env,VERCEL_ENV:'production',LUO_FEED_RANKING_ENABLED:'true'}),true);
 assert.equal(recommendationEnabled({...env,VERCEL_GIT_COMMIT_REF:'main'}),false);
});
test('API validation rejects irrelevant actions, forged origins, unbounded params and invalid cursor',()=>{
 const cases=[
 [request({}, {method:'GET'}),405],
 [request({kind:'hidden'}),400],
 [request({mode:'admin'}),400],
 [request({before:'2026-01-01T00:00:00Z'}),400],
 [request({before:'tomorrow',before_id:uuid(1)}),400],
 [request({role:'root'}),400],
 [request({}, {headers:{'content-type':'text/html'}}),415],
 [request({}, {headers:{'content-type':'application/json','sec-fetch-site':'cross-site'}}),403],
 [request({}, {headers:{'content-type':'application/json',origin:'https://malicious.example'}}),403]
 ];
 for(const [req,status] of cases)assert.equal(validateRankingRequest(req,env).status,status,JSON.stringify(req.body));
});
test('endpoint enforces fresh user authorization and fetches only through user-scoped Supabase RPC',async()=>{
 const source=[post(1),post(2),post(3)];
 const {clientFactory,getCaptured}=clientFor(source);
 const handler=createRecommendationHandler({env,clientFactory,now:()=>now,rateLimit:()=>false});
 const res=response();
 await handler(request(),res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.items.length,3);
 assert.equal(res.body.authorized_by,'luo_space');
 assert.equal(res.body.trained_phoenix_model,false);
 assert.equal(res.body.cursor.before,post(3).created_at);
 assert.equal(res.headers['Cache-Control'],'private, no-store');
 assert.equal(getCaptured().key,env.SUPABASE_PUBLISHABLE_KEY);
 assert.equal(getCaptured().headers.Authorization,'Bearer '+token);
 assert.ok(!JSON.stringify(res.body).includes(token));
});
test('endpoint rejects unauthorized requests before fetching private media or using privileged keys',async()=>{
 const {clientFactory}=clientFor([post(1)]),handler=createRecommendationHandler({env,clientFactory,rateLimit:()=>false});
 const bad=response();
 await handler(request({}, {headers:{'content-type':'application/json'}}),bad);
 assert.equal(bad.statusCode,401);
 const disabled=response();
 await createRecommendationHandler({env:{...env,VERCEL_ENV:'production'},clientFactory})(request(),disabled);
 assert.equal(disabled.statusCode,503);
 assert.equal(disabled.body.error.code,'RANKING_NOT_ACTIVATED');
 const throttled=response();
 await createRecommendationHandler({env,clientFactory,rateLimit:()=>true})(request(),throttled);
 assert.equal(throttled.statusCode,429);
 assert.equal(throttled.headers['Retry-After'],'60');
});
test('Git submodule pins Apache-licensed upstream and the Luo integration remains opt-in',async()=>{
 const gitmodules=await readFile('.gitmodules','utf8');
 const license=await readFile('third_party/xai-for-you-source/LICENSE','utf8');
 const frontend=await readFile('src/social-feed.js','utf8');
 const backend=await readFile('api/recommendations.js','utf8');
 assert.ok(gitmodules.includes('github.com/xai-org/x-algorithm.git'));
 assert.ok(gitmodules.includes('update = none'));
 assert.ok(license.includes('Apache License'));
 assert.ok(frontend.includes("searchParams.get('luo_ranker')==='1'"));
 assert.ok(frontend.includes('rankedInfo?.cursor'));
 assert.ok(frontend.includes("data=await rpc('feed'"));
 assert.ok(backend.includes('getUser(token)'));
 assert.ok(!backend.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
