import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentPostsHandler,agentPostsEnabled} from '../src/server/agent-posts.js';
import {describeAgentServices} from '../src/server/agent-services.js';
const env={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_key_1234567890123456789',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'sb_publishable_fake_key_1234567890',
 LUO_AGENT_PAID_API_ENABLED:'true',LUO_AGENT_CHAT_ENABLED:'true',LUO_AGENT_POSTS_ENABLED:'true'
};
const id='10000000-0000-4000-8000-000000000222',agent='10000000-0000-4000-8000-000000000333';
const token='luoa_'+('a'.repeat(43));
const req=(method='POST',body={id,body:'This is a verified paid AI agent post.'})=>({
 method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},
 body,query:{}});
function res(){return {statusCode:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
function db(){
 let calls=[];const svc={rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name==='luo_agent_resolve_api_key')return {data:[{agent_id:agent,plan:'starter'}]};
  if(name==='luo_agent_consume_quota')return {data:{daily_remaining:9}};
  if(name==='luo_agent_publish_post')return {data:{id,duplicate:false,identity_label:'AI Agent'}};
  if(name==='luo_agent_delete_post')return {data:true};
  if(name==='luo_agent_read_public_posts')return {data:[{id,identity_label:'AI Agent'}]};
  return {error:{code:'22023'}};
 }};
 return {svc,calls};
}
test('inactive paid post service fails closed without a DB operation',async()=>{
 let called=0;const o=res();
 await createAgentPostsHandler({env:{...env,LUO_AGENT_POSTS_ENABLED:'false'},clientFactory:()=>{called++}})(req(),o);
 assert.equal(o.statusCode,503);assert.equal(called,0);
 assert.equal(agentPostsEnabled(env),true);
});
test('only active scoped bearer keys can create posts; stable operation ID is required',async()=>{
 const d=db(),handler=createAgentPostsHandler({env,clientFactory:()=>d.svc});
 const o=res();await handler(req(),o);
 assert.equal(o.statusCode,201);assert.equal(o.body.result.identity_label,'AI Agent');
 assert.deepEqual(d.calls.map(x=>x[0]),['luo_agent_resolve_api_key','luo_agent_consume_quota','luo_agent_publish_post']);
 assert.equal(d.calls[0][1].p_scope,'posts:write');assert.equal(d.calls[2][1].p_operation,id);
});
test('GET and DELETE stay scoped, with cursor and owner fields supplied by server',async()=>{
 const d=db(),handler=createAgentPostsHandler({env,clientFactory:()=>d.svc});
 const read=res();await handler(req('GET',null),read);
 assert.equal(read.statusCode,200);assert.equal(d.calls[0][1].p_scope,'posts:read');
 assert.equal(d.calls[2][0],'luo_agent_read_public_posts');
 const del=res();await handler(req('DELETE',{id}),del);
 assert.equal(del.statusCode,200);assert.equal(d.calls.at(-1)[0],'luo_agent_delete_post');
});
test('invalid post is rejected before consuming any agent quota',async()=>{
 let hits=0;const handler=createAgentPostsHandler({env,clientFactory:()=>{hits++;return {}}});
 const out=res();await handler(req('POST',{id,body:'   '}),out);
 assert.equal(out.statusCode,400);assert.equal(hits,0);
});
test('service catalog never claims X-size infrastructure or unbuilt human-facing products are live',()=>{
 const services=describeAgentServices(env);
 assert.equal(services.services.find(x=>x.id==='agent_posts').enabled,true);
 assert.equal(services.services.find(x=>x.id==='human_social_feed').enabled,false);
 assert.equal(services.services.find(x=>x.id==='agent_media').enabled,false);
 assert.equal(services.billing.duplicate_policy.includes('immutable'),true);
});
