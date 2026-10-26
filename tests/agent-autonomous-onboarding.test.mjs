import test from 'node:test';
import assert from 'node:assert/strict';
import {describeAutonomousOnboarding,createAgentOnboardingHandler} from '../src/server/agent-onboarding.js';
import {createAgentRegistrationHandler} from '../src/server/agent-registration.js';
import {agentRuntime} from '../src/server/agent-environment.js';
import {verificationRuntime} from '../src/server/agent-verification.js';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_role_credential_length_adequate_for_testing',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'fake_publishable_credential_length_adequate_for_testing',
 LUO_AGENT_PENDING_REGISTRATION_ENABLED:'true',LUO_AGENT_SIGNUP_HASH_KEY:'a'.repeat(48),
 LUO_AGENT_REQUIRE_VERIFIED_KEY:'true',LUO_AGENT_VERIFICATION_ENABLED:'true'};
const proof='31613b2b-6cc1-49ab-a843-43c4a60a4a9b';
const data={username:'bot_alpha',password:'long super secure password',plan:'starter',verification_id:proof};
const makeRes=()=>({statusCode:0,body:null,headers:{},setHeader(n,v){this.headers[n]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
const request=(payload=data)=>({method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.88'},body:payload});
test('new isolated branch accepts only the staging project',()=>{
 assert.equal(agentRuntime(env)?.mode,'sandbox');
 assert.equal(verificationRuntime(env)?.mode,'staging');
 assert.equal(agentRuntime({...env,VERCEL_GIT_COMMIT_REF:'main'}),null);
 assert.equal(agentRuntime({...env,LUO_AGENT_STAGING_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co'}),null);
});
test('autonomous discovery returns paid-only plans without promising live readiness',()=>{
 const info=describeAutonomousOnboarding(env);
 assert.deepEqual(info.subscription.plans.map(p=>p.monthly_price),[12,24,30]);
 assert.equal(info.human_owner_approval_required,false);
 assert.equal(info.capabilities.verified_key_required,true);
 assert.equal(info.status,'not_available');
 assert.ok(info.steps[2].body_keys.includes('verification_id'));
});
test('discovery is GET-only',()=>{
 const handler=createAgentOnboardingHandler({env});
 const ok=makeRes();handler({method:'GET'},ok);assert.equal(ok.statusCode,200);
 const bad=makeRes();handler({method:'POST'},bad);assert.equal(bad.statusCode,405);
});
test('registration without verified key is blocked before any database calls',async()=>{
 let touched=0;
 const handler=createAgentRegistrationHandler({env,clientFactory:()=>{touched++;throw Error('Unexpected DB')}});
 const out=makeRes();await handler(request({...data,verification_id:undefined}),out);
 assert.equal(out.statusCode,400);assert.equal(out.body.error.code,'VERIFIED_KEY_REQUIRED');assert.equal(touched,0);
});
test('registration uses verified proof binding RPC, not the legacy unverified RPC',async()=>{
 const calls=[],db={
  rpc:async(name,args)=>{calls.push([name,args]);return name==='luo_agent_reserve_pending_signup'?{data:true}:{data:proof}},
  auth:{admin:{createUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}}),deleteUser:async()=>({})}}
 };
 const out=makeRes();await createAgentRegistrationHandler({env,clientFactory:()=>db})(request(),out);
 assert.equal(out.statusCode,201);assert.equal(out.body.agent.key_proof_bound,true);
 assert.deepEqual(calls.map(x=>x[0]),['luo_agent_reserve_pending_signup','luo_agent_create_verified_pending_identity']);
 assert.equal(calls[1][1].p_verification,proof);
 assert.equal(out.body.api_credential_issued,false);
});
