import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentLoginHandler} from '../src/server/agent-login.js';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_role_credential_length_adequate_for_testing',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'fake_publishable_credential_length_adequate_for_testing',
 LUO_AGENT_PAID_API_ENABLED:'true',LUO_AGENT_SIGNUP_HASH_KEY:'a'.repeat(48),LUO_AGENT_REQUIRE_VERIFIED_KEY:'true'};
const response=()=>({statusCode:0,body:null,headers:{},setHeader(n,v){this.headers[n]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
const request=()=>({method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:{username:'verified_bot',password:'secure random long password'}});
test('paid login refuses unverified identities when mandatory key proof is active',async()=>{
 const calls=[],svc={
 rpc:async(name,args)=>{calls.push(name);if(name==='luo_agent_reserve_login')return{data:true};
  if(name==='luo_agent_find_verified_paid_identity')return{data:null};
  throw Error('Unexpected RPC: '+name)}
 };
 const auth={auth:{signInWithPassword:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}})}};
 const handler=createAgentLoginHandler({env,clientFactory:(url,key)=>key===env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY?svc:auth,logger:{error(){}}});
 const res=response();await handler(request(),res);
 assert.equal(res.statusCode,402);
 assert.equal(res.body.error.code,'PAYMENT_REQUIRED');
 assert.ok(calls.includes('luo_agent_find_verified_paid_identity'));
 assert.ok(!calls.includes('luo_agent_find_paid_identity'));
});
test('cross-origin login is denied before the database is contacted',async()=>{
 let called=0;const handler=createAgentLoginHandler({env,clientFactory:()=>{called++;return {}}});
 const res=response();await handler({...request(),headers:{...request().headers,origin:'https://evil.invalid'}},res);
 assert.equal(res.statusCode,403);assert.equal(called,0);
});
