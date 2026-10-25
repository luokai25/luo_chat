import test from 'node:test';import assert from 'node:assert/strict';
import {createAgentMessagingHandler,agentMessagingEnabled} from '../src/server/agent-messaging.js';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/reels-immersive-20261025',
 LUO_AGENT_PAID_API_ENABLED:'true',LUO_AGENT_CHAT_ENABLED:'true',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'not_a_real_service_role_secret_for_testing_123456789'};
const token='luoa_'+Buffer.alloc(32,2).toString('base64url');
const agent='11111111-1111-4111-8111-111111111111';
const peer='22222222-2222-4222-8222-222222222222';
const msg='33333333-3333-4333-8333-333333333333';
function response(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
function request(body,method='POST'){return{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body,query:{peer}}}
function fixture({deny=false,quota=false}={}){
 const events=[];
 const db={rpc:async(name,args)=>{events.push([name,args]);if(name==='luo_agent_resolve_api_key')return{data:[{agent_id:agent}]};if(name==='luo_agent_consume_quota')return quota?{error:{code:'P0001'}}:{data:{daily_remaining:12}};if(deny)return{error:{code:'28000'}};return{data:{id:msg,identity_label:'AI Agent'}}}};
 return {events,client:()=>db};
}
test('disabled staging prevents chat access even with paid-profile token',async()=>{
 assert.equal(agentMessagingEnabled({...env,LUO_AGENT_CHAT_ENABLED:'false'}),false);
 const r=response();await createAgentMessagingHandler({env:{...env,LUO_AGENT_CHAT_ENABLED:'false'}})(request({to:peer,id:msg,text:'hi'}),r);
 assert.equal(r.statusCode,503);
});
test('agent message is charged by API and passes idempotency to server-side consent RPC',async()=>{
 const m=fixture(),r=response();await createAgentMessagingHandler({env,clientFactory:m.client})(request({to:peer,id:msg,text:'hello bot'}),r);
 assert.equal(r.statusCode,200);assert.equal(r.body.identity_label,'AI Agent');
 assert.deepEqual(m.events.map(x=>x[0]),['luo_agent_resolve_api_key','luo_agent_consume_quota','luo_agent_send_peer_message']);
 assert.equal(m.events[0][1].p_scope,'chat:write');assert.equal(m.events[2][1].p_client_id,msg);
});
test('peer search and approval are different scopes, no unsolicited chat',async()=>{
 const m=fixture();
 let r=response();await createAgentMessagingHandler({mode:'peers',env,clientFactory:m.client})(request({action:'find',username:'some_bot'}),r);
 assert.equal(r.statusCode,200);assert.equal(m.events[0][1].p_scope,'chat:read');
 r=response();await createAgentMessagingHandler({mode:'peers',env,clientFactory:m.client})(request({action:'approve',peer}),r);
 assert.equal(r.statusCode,200);assert.equal(m.events[3][1].p_scope,'chat:write');
});
test('no cross-agent messages without approval and account state verified by DB',async()=>{
 const m=fixture({deny:true}),r=response();await createAgentMessagingHandler({env,clientFactory:m.client})(request({to:peer,id:msg,text:'hello'}),r);
 assert.equal(r.statusCode,403);assert.equal(r.body.error.code,'CONSENT_OR_IDENTITY_REQUIRED');
});
test('limit breach uses Retry-After and never sends a message',async()=>{
 const m=fixture({quota:true}),r=response();await createAgentMessagingHandler({env,clientFactory:m.client})(request({to:peer,id:msg,text:'hello'}),r);
 assert.equal(r.statusCode,429);assert.equal(r.headers['Retry-After'],'60');
 assert.deepEqual(m.events.map(x=>x[0]),['luo_agent_resolve_api_key','luo_agent_consume_quota']);
});
test('improper payload, invalid credentials and forged peer IDs fail before messaging',async()=>{
 const m=fixture(),handler=createAgentMessagingHandler({env,clientFactory:m.client});
 for(const data of [{to:peer,id:msg,text:''},{to:peer,id:msg,text:'hello',is_admin:true},{to:'wrong',id:msg,text:'hello'},{to:peer,id:msg,text:'a'.repeat(4001)}]){const r=response();await handler(request(data),r);assert.equal(r.statusCode,400)}
 const r=response();await handler({...request({to:peer,id:msg,text:'hello'}),headers:{authorization:'Bearer forged','content-type':'application/json'}},r);
 assert.equal(r.statusCode,401);assert.equal(m.events.length,0);
});
