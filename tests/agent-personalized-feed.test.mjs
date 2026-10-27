import test from 'node:test';
import assert from 'node:assert/strict';
import {rankAgentFeed,AGENT_FEED_VERSION} from '../src/server/agent-feed-ranking.js';
import {createAgentPostsHandler} from '../src/server/agent-posts.js';
import {describeAgentServices} from '../src/server/agent-services.js';
const uid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now=Date.parse('2026-10-27T05:00:00Z');
const row=(id,author,extra={})=>({id:uid(id),agent_id:uid(author),username:'agent_'+author,identity_label:'AI Agent',
 body:'Useful public agent post '+id,created_at:new Date(now-3600000).toISOString(),viewer_follows_author:false,...extra});
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_key_1234567890123456789',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'sb_publishable_fake_key_1234567890',
 LUO_AGENT_PAID_API_ENABLED:'true',LUO_AGENT_POSTS_ENABLED:'true'};
const token='luoa_'+('a'.repeat(43));
const response=()=>({statusCode:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.statusCode=s;return this},json(x){this.body=x;return this}});
const req=(method,body,query={})=>({method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body,query});
test('ranking prefers followed paid authors without duplicating or discarding fetched posts',()=>{
 const entries=[row(1,51),row(2,52,{viewer_follows_author:true}),row(3,51),row(4,53)];
 const ranked=rankAgentFeed(entries,{now});
 assert.deepEqual(new Set(ranked.map(x=>x.id)),new Set(entries.map(x=>x.id)));
 assert.equal(ranked[0].id,uid(2));
 assert.equal(ranked[0].rank_reason,'following');
 assert.equal(AGENT_FEED_VERSION,'luo-agents-for-you-1');
});
test('ranking drops forged non-agent, future and invalid entries before presentation',()=>{
 const items=rankAgentFeed([row(1,52,{identity_label:'Human'}),row(2,53,{created_at:new Date(now+3600000).toISOString()}),row(3,54)],{now});
 assert.deepEqual(items.map(x=>x.id),[uid(3)]);
});
test('agent feed API uses paid scoped token, supports real cursor, no human data',async()=>{
 const calls=[];const rows=[row(21,60),row(22,61,{viewer_follows_author:true})];
 const db={rpc:async(name,args)=>{calls.push([name,args]);if(name==='luo_agent_resolve_api_key')return{data:[{agent_id:uid(9)}]};
 if(name==='luo_agent_consume_quota')return{data:{daily_remaining:80}};
 if(name==='luo_agent_read_public_posts')return{data:rows};
 return{error:{code:'22023'}}}};
 const res=response();await createAgentPostsHandler({mode:'feed',env,clientFactory:()=>db})(req('GET',null,{limit:'2'}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.has_more,true);
 assert.equal(res.body.cursor.before_id,uid(22));
 assert.equal(res.body.items[0].id,uid(22));
 assert.equal(calls[0][1].p_scope,'posts:read');
 assert.equal(calls.at(-1)[0],'luo_agent_read_public_posts');
 assert.equal(res.body.privacy,'only-active-paid-agent-posts');
});
test('author follow/mute preferences require write scope and allowed actions',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push([name,args]);if(name==='luo_agent_resolve_api_key')return{data:[{agent_id:uid(9)}]};
 if(name==='luo_agent_consume_quota')return{data:{}};
 if(name==='luo_agent_set_feed_preference')return{data:{author_id:args.p_author,relation:args.p_action}};
 return{error:{code:'22023'}}}};
 const handler=createAgentPostsHandler({mode:'preferences',env,clientFactory:()=>db});
 const ok=response();await handler(req('POST',{action:'mute',author_id:uid(52)}),ok);
 assert.equal(ok.statusCode,200);
 assert.deepEqual(calls.map(x=>x[0]),['luo_agent_resolve_api_key','luo_agent_consume_quota','luo_agent_set_feed_preference']);
 assert.equal(calls[0][1].p_scope,'posts:write');
 const bad=response();await handler(req('POST',{action:'block_all',author_id:uid(52)}),bad);assert.equal(bad.statusCode,400);
 const services=describeAgentServices(env);
 assert.equal(services.services.find(x=>x.id==='agent_personalized_feed').enabled,true);
 assert.equal(services.services.find(x=>x.id==='human_social_feed').enabled,false);
});
test('inactive agent preference and feed APIs fail before hitting any DB',async()=>{
 let n=0;const handler=createAgentPostsHandler({mode:'feed',env:{...env,LUO_AGENT_POSTS_ENABLED:'false'},clientFactory:()=>{n++}});
 const res=response();await handler(req('GET'),res);
 assert.equal(res.statusCode,503);assert.equal(n,0);
});
