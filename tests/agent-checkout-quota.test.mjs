import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCheckoutHandler} from '../src/server/agent-billing.js';
const env={
 VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_credential_long_enough_for_testing',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'fake_public_credential_long_enough_for_testing',
 LUO_AGENT_BILLING_ENABLED:'true',LUO_AGENT_REQUIRE_VERIFIED_KEY:'true',
 LUO_AGENT_SIGNUP_HASH_KEY:'q'.repeat(48),
 LUO_PAYPAL_ENV:'sandbox',LUO_PAYPAL_CLIENT_ID:'fake_sandbox_client_identifier',
 LUO_PAYPAL_CLIENT_SECRET:'fake_sandbox_client_secret_long_enough',
 LUO_PAYPAL_PLAN_STANDARD_REGULAR:'P-ABCDEF01234567890',
 LUO_PAYPAL_PLAN_PRO_REGULAR:'P-ABCDEF01234567891',
 LUO_PAYPAL_PLAN_MAXIMUM_REGULAR:'P-ABCDEF01234567892'
};
const r=()=>({statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
const req=()=>({method:'POST',headers:{'content-type':'application/json',host:'luo-chat-luokai25-abcdef12-luokai25s-projects.vercel.app',
 'x-vercel-forwarded-for':'192.0.2.18'},body:{username:'bot_123',password:'a long secret password',plan:'starter',provider:'paypal'}});
test('checkout rejects missing trusted network source without touching provider',async()=>{
 let calls=0;const result=r();
 await createAgentCheckoutHandler({env,clientFactory:()=>{calls++;return{}},fetcher:()=>{throw Error('Must not call provider')}})(
 {...req(),headers:{...req().headers,'x-vercel-forwarded-for':'192.0.2.18,8.8.8.8'}},result);
 assert.equal(result.statusCode,503);assert.equal(calls,1);
});
test('checkout rate limit stops payment preflight and password login',async()=>{
 const calls=[],db={rpc:async(name,values)=>{calls.push([name,values]);return{error:{code:'P0001'}}}};
 const result=r();await createAgentCheckoutHandler({env,clientFactory:()=>db,
 fetcher:()=>{throw Error('Must not call provider')}})(req(),result);
 assert.equal(result.statusCode,429);assert.equal(result.body.error.code,'CHECKOUT_RATE_LIMITED');
 assert.deepEqual(calls.map(x=>x[0]),['luo_agent_reserve_login']);
 assert.match(calls[0][1].p_ip_digest,/^[a-f0-9]{64}$/);
});
