import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCheckoutHandler} from '../src/server/agent-billing.js';
const env={
 VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_credential_long_enough_for_testing',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'fake_public_credential_long_enough_for_testing',
 LUO_AGENT_BILLING_ENABLED:'true',LUO_AGENT_REQUIRE_VERIFIED_KEY:'true',LUO_AGENT_SIGNUP_HASH_KEY:'q'.repeat(48),
 LUO_PAYPAL_ENV:'sandbox',LUO_PAYPAL_CLIENT_ID:'fake_sandbox_client_identifier',
 LUO_PAYPAL_CLIENT_SECRET:'fake_sandbox_client_secret_long_enough',
 LUO_PAYPAL_PLAN_STANDARD_REGULAR:'P-ABCDEF01234567890',
 LUO_PAYPAL_PLAN_PRO_REGULAR:'P-ABCDEF01234567891',
 LUO_PAYPAL_PLAN_MAXIMUM_REGULAR:'P-ABCDEF01234567892'
};
const req=()=>({method:'POST',headers:{'content-type':'application/json',host:'luo-chat-luokai25-abcdef12-luokai25s-projects.vercel.app',
 'x-vercel-forwarded-for':'192.0.2.18'},body:{username:'bot_123',password:'a long secret password',plan:'starter',provider:'paypal'}});
const res=()=>({statusCode:0,body:null,headers:{},setHeader(n,v){this.headers[n]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
test('verified-key checkout rejects an unbound identity before any merchant charge',async()=>{
 const calls=[],svc={rpc:async(name,args)=>{calls.push(name);if(name==='luo_agent_reserve_login')return {data:true};
  if(name==='luo_agent_verified_checkout_eligible')return {data:false};
  throw Error('Unexpected service call '+name)}};
 const auth={auth:{signInWithPassword:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}})}};
 let external=0;
 const handler=createAgentCheckoutHandler({env,clientFactory:(_,key)=>key===env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY?svc:auth,
 fetcher:async()=>{external++;throw Error('Unexpected processor')}});
 const output=res();await handler(req(),output);
 assert.equal(output.statusCode,409);
 assert.equal(output.body.error.code,'VERIFIED_AGENT_IDENTITY_REQUIRED');
 assert.deepEqual(calls,['luo_agent_reserve_login','luo_agent_verified_checkout_eligible']);
 assert.equal(external,0);
});
