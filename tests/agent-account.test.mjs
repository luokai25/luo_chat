import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {paidAgentApiEnabled,newAgentCredential,createAgentAccountHandler} from '../src/server/agent-account.js';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/reels-immersive-20261025',LUO_AGENT_PAID_API_ENABLED:'true',LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fixture_nonproduction_service_role_123456789'};
const uuid='5a641a30-2a80-41e8-bf29-4abce57f529f';
function response(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
function fixture(token,mode='profile'){return {method:'GET',headers:{authorization:'Bearer '+token}}}
const token=newAgentCredential(()=>Buffer.alloc(32,7));
test('API token is random-byte based, hashed at rest, short and never output by private responses',()=>{
 assert.match(token.token,/^luoa_[A-Za-z0-9_-]{43}$/);
 assert.equal(token.prefix,token.token.slice(0,13));
 assert.equal(token.hash,'\\x'+createHash('sha256').update(token.token).digest('hex'));
 assert.ok(!token.hash.includes(token.token));
});
test('paid endpoint is never on in production or without a dedicated staging service secret',()=>{
 assert.equal(paidAgentApiEnabled(env),true);
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{LUO_AGENT_STAGING_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co'},{LUO_AGENT_PAID_API_ENABLED:'false'},{LUO_AGENT_STAGING_SERVICE_ROLE_KEY:''}])assert.equal(paidAgentApiEnabled({...env,...change}),false);
});
test('a paid profile requires scoped bearer, atomic quota debit and private read',async()=>{
 const calls=[];
 const clientFactory=()=>({rpc:async(name,params)=>{calls.push([name,params]);if(name==='luo_agent_resolve_api_key')return{data:[{agent_id:uuid,plan:'starter'}]};if(name==='luo_agent_consume_quota')return{data:{daily_remaining:999,minute_remaining:19}};return{data:{id:uuid,username:'goldenbot',identity_label:'AI Agent',plan:'starter'}}}});
 const output=response();await createAgentAccountHandler({env,clientFactory})(fixture(token.token),output);
 assert.equal(output.statusCode,200);assert.equal(output.body.username,'goldenbot');assert.equal(output.body.quota.daily_remaining,999);
 assert.deepEqual(calls.map(c=>c[0]),['luo_agent_resolve_api_key','luo_agent_consume_quota','luo_agent_read_profile']);
 assert.equal(calls[0][1].p_hash,token.hash);
 assert.equal(calls[0][1].p_scope,'profile:read');
 assert.ok(!JSON.stringify(output.body).includes(token.token));
});
test('quota exhaustion returns HTTP429 and Retry-After without leaking backend internals',async()=>{
 const db={rpc:async name=>name==='luo_agent_resolve_api_key'?{data:[{agent_id:uuid}]}:{error:{code:'P0001',message:'private error'}}};
 const output=response();await createAgentAccountHandler({env,clientFactory:()=>db})(fixture(token.token),output);
 assert.equal(output.statusCode,429);assert.equal(output.headers['Retry-After'],'60');assert.doesNotMatch(JSON.stringify(output.body),/private/);
});
test('unknown or swapped credentials are rejected before any costly operation',async()=>{
 const calls=[],db={rpc:async (name)=>{calls.push(name);return{data:[]}}};
 const handler=createAgentAccountHandler({env,clientFactory:()=>db});
 for(const authorization of [undefined,'Bearer abc','Bearer luoa_'+('x'.repeat(30))]){
  const output=response();await handler({method:'GET',headers:{authorization}},output);assert.equal(output.statusCode,401);
 }
 assert.equal(calls.length,0);
 const output=response();await handler(fixture(token.token),output);assert.equal(output.statusCode,401);assert.deepEqual(calls,['luo_agent_resolve_api_key']);
});
test('usage endpoint uses independent usage-read scope',async()=>{
 const calls=[],db={rpc:async (name,params)=>{calls.push([name,params]);if(name==='luo_agent_resolve_api_key')return{data:[{agent_id:uuid}]};if(name==='luo_agent_consume_quota')return{data:{daily_remaining:40}};return{data:{usage:{api:4}}}}};
 const output=response();await createAgentAccountHandler({mode:'usage',env,clientFactory:()=>db})(fixture(token.token),output);
 assert.equal(output.statusCode,200);assert.equal(calls[0][1].p_scope,'usage:read');assert.equal(calls[2][0],'luo_agent_read_usage');
});
