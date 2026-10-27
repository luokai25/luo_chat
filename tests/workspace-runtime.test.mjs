import test from 'node:test';import assert from 'node:assert/strict';
import {effectiveAgentEnvironment,assertWorkspaceRelease,paypalCashEvidence} from '../src/server/workspace-controls.js';
const env={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'release/payments-secondary-complete-20261027',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),LUO_AGENT_PRODUCTION_ENABLED:'true',LUO_AGENT_PRODUCTION_DATABASE_READY:'true',LUO_AGENT_LIVE_SECRET_ROTATED:'true',SUPABASE_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(40),SUPABASE_PUBLISHABLE_KEY:'p'.repeat(30),LUO_WORKSPACE_CONTROLS_ENABLED:'true',LUO_AGENT_BILLING_ENABLED:'true',LUO_AGENT_LIVE_CHECKOUT_ENABLED:'true',LUO_AGENT_LIVE_WEBHOOK_ENABLED:'true',LUO_AGENT_PENDING_REGISTRATION_ENABLED:'false',LUO_AGENT_PAID_API_ENABLED:'true',LUO_AGENT_POSTS_ENABLED:'true',LUO_AGENT_CHAT_ENABLED:'true'};
const controls={flags:{registration:true,checkout:false,paid_api:true,posts:false,chat:true},approved_commit:'a'.repeat(40),approved_branch:env.VERCEL_GIT_COMMIT_REF,deployment_hold:false,not_before:'2026-01-01T00:00:00Z'};
const reply=c=>async()=>({ok:true,json:async()=>c});
test('owner switches only restrict environment permissions and preserve webhook processing',async()=>{
const e=await effectiveAgentEnvironment(env,reply(controls));assert.equal(e.LUO_AGENT_BILLING_ENABLED,'false');assert.equal(e.LUO_AGENT_LIVE_CHECKOUT_ENABLED,'false');assert.equal(e.LUO_AGENT_PENDING_REGISTRATION_ENABLED,'false');assert.equal(e.LUO_AGENT_LIVE_WEBHOOK_ENABLED,'true');assert.equal(e.LUO_AGENT_POSTS_ENABLED,'false');
const outage=await effectiveAgentEnvironment(env,async()=>{throw Error('offline')});assert.equal(outage.LUO_AGENT_CHAT_ENABLED,'false');assert.equal(outage.LUO_AGENT_LIVE_WEBHOOK_ENABLED,'true');assert.equal(outage.LUO_AGENT_PRODUCTION_ENABLED,'true');
});
test('release guard checks hold, exact commit, branch and quota delay and fails closed',async()=>{
await assertWorkspaceRelease(env,reply(controls));for(const bad of [{deployment_hold:true},{approved_commit:'b'.repeat(40)},{approved_branch:'main'},{not_before:'2999-01-01T00:00:00Z'}])await assert.rejects(assertWorkspaceRelease(env,reply({...controls,...bad})));
await assert.rejects(assertWorkspaceRelease(env,async()=>({ok:false})));
});
test('cash evidence uses provider IDs, exact USD cents and verified fee breakdown, rejecting estimates',()=>{
const base={id:'TX-12345',status:'COMPLETED',time:'2026-10-20T12:00:00Z',amount_with_breakdown:{gross_amount:{currency_code:'USD',value:'12.00'}}},intent={regular_cents:1200,first_invoice_cents:1200};
assert.deepEqual(paypalCashEvidence([base],intent),[{id:'TX-12345',gross:1200,fee:null,net:null,time:base.time.replace('Z','.000Z')}]);
const b={...base,amount_with_breakdown:{...base.amount_with_breakdown,fee_amount:{currency_code:'USD',value:'0.75'},net_amount:{currency_code:'USD',value:'11.25'}}};assert.equal(paypalCashEvidence([b],intent)[0].fee,75);assert.deepEqual(paypalCashEvidence([{...base,status:'PENDING'},{...base,id:null},{...base,time:'bad'}],intent),[]);
});
