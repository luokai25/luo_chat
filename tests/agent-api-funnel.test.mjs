import test from 'node:test';import assert from 'node:assert/strict';
import {captureAgentApiFunnel} from '../src/server/agent-api-funnel.js';
test('server funnel events hash identities and never send passwords or raw usernames',async()=>{
 const calls=[];const env={LUO_POSTHOG_KEY:'write-key',LUO_TELEMETRY_SALT:'test-only-salt-with-enough-length'};
 await captureAgentApiFunnel({env,route:'billing/checkout',method:'POST',statusCode:201,
  requestBody:{username:'Example_Agent',password:'never-send-this',plan:'pro',provider:'paypal'},
  responseBody:{intent_id:'11111111-1111-4111-8111-111111111111',checkout_url:'https://www.paypal.com/checkout'},
  fetcher:async(url,init)=>{calls.push([url,init]);return{ok:true}}});
 assert.equal(calls.length,1);const body=JSON.parse(calls[0][1].body);
 assert.equal(body.event,'luo_agent_api_funnel');assert.equal(body.properties.step,'agent_checkout_attempt');
 assert.equal(body.properties.plan,'pro');assert.equal(body.properties.provider,'paypal');
 assert.equal(body.properties.intent_id_hash.length,64);assert.equal(body.properties.distinct_id.includes('Example_Agent'),false);
 assert.equal(JSON.stringify(body).includes('never-send-this'),false);
});
test('analytics failure is fail-open and missing configuration disables capture',async()=>{
 let calls=0;await captureAgentApiFunnel({env:{},route:'agents/register',method:'POST',statusCode:201,requestBody:{username:'agent'},fetcher:async()=>{calls++}});
 assert.equal(calls,0);
 await captureAgentApiFunnel({env:{LUO_POSTHOG_KEY:'x',LUO_TELEMETRY_SALT:'long-enough-test-salt'},route:'agents/register',method:'POST',statusCode:201,requestBody:{username:'agent'},fetcher:async()=>{calls++;throw Error('offline')}});
 assert.equal(calls,1);
});
