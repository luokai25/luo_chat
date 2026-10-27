import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutReady,createAgentCheckoutHandler} from '../src/server/agent-billing.js';
import {webhookReady,createPaymentWebhookHandler} from '../src/server/agent-payment-webhooks.js';
import {agentRuntime} from '../src/server/agent-environment.js';

const safeFixture={
 VERCEL_ENV:'production',LUO_AGENT_PRODUCTION_ENABLED:'true',
 LUO_AGENT_PRODUCTION_DATABASE_READY:'true',LUO_AGENT_LIVE_SECRET_ROTATED:'true',
 SUPABASE_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'fixture_service_role_0000000000000000000000',
 SUPABASE_PUBLISHABLE_KEY:'fixture_publishable_0000000000000000000',
 LUO_PAYPAL_LIVE_CLIENT_ID:'fixture_client_id_000000000000',
 LUO_PAYPAL_LIVE_CLIENT_SECRET:'fixture_client_secret_000000000000',
 LUO_PAYPAL_PLAN_STANDARD_REGULAR:'P-4KE07040G5697374RNLPE3GI',
 LUO_PAYPAL_PLAN_PRO_REGULAR:'P-1B27162996533990SNLPE64I',
 LUO_PAYPAL_PLAN_MAXIMUM_REGULAR:'P-51S06783TK159900ENLPE7SI',
 LUO_PAYPAL_LIVE_WEBHOOK_ID:'RESTWEBHOOK1234567890',
 LUO_AGENT_PROMOTIONS_ENABLED:'false',
 LUO_AGENT_BILLING_ENABLED:'true',
 LUO_AGENT_LIVE_CHECKOUT_ENABLED:'true',
 LUO_AGENT_LIVE_WEBHOOK_ENABLED:'true'
};
function res(){
 return{statusCode:200,headers:{},body:null,
 setHeader(key,value){this.headers[key]=value;return this},
 status(code){this.statusCode=code;return this},
 json(value){this.body=value;return this}};
}
function request(){
 return{method:'POST',headers:{'content-type':'application/json',host:'luo-chat-luokai25.vercel.app',
  origin:'https://luo-chat-luokai25.vercel.app', 'sec-fetch-site':'same-origin'},
 body:{username:'agent_trial',password:'a long password for testing',plan:'starter',provider:'paypal'}};
}
test('PayPal checkout remains unavailable until all independent operator enable flags are supplied',()=>{
 assert.equal(agentRuntime(safeFixture)?.mode,'live');
 assert.equal(checkoutReady(safeFixture,'paypal'),true,'a structurally complete fixture reaches external preflight next');
 const required=[
  'LUO_AGENT_PRODUCTION_ENABLED','LUO_AGENT_PRODUCTION_DATABASE_READY','LUO_AGENT_LIVE_SECRET_ROTATED',
  'LUO_AGENT_BILLING_ENABLED','LUO_AGENT_LIVE_CHECKOUT_ENABLED','LUO_AGENT_LIVE_WEBHOOK_ENABLED',
  'LUO_PAYPAL_LIVE_CLIENT_ID','LUO_PAYPAL_LIVE_CLIENT_SECRET','LUO_PAYPAL_LIVE_WEBHOOK_ID',
  'LUO_PAYPAL_PLAN_STANDARD_REGULAR','LUO_PAYPAL_PLAN_PRO_REGULAR','LUO_PAYPAL_PLAN_MAXIMUM_REGULAR'
 ];
 for(const flag of required){
  const testEnv={...safeFixture};delete testEnv[flag];
  assert.equal(checkoutReady(testEnv,'paypal'),false,'Removing '+flag+' must prevent a live checkout');
 }
 assert.equal(checkoutReady({...safeFixture,LUO_AGENT_PROMOTIONS_ENABLED:'true'},'paypal'),false);
});
test('blocked live checkout returns 503 without contacting PayPal or modifying any agent ledger',async()=>{
 let outbound=0;
 const handler=createAgentCheckoutHandler({
  env:{...safeFixture,LUO_AGENT_BILLING_ENABLED:'false'},
  clientFactory:()=>{outbound++;throw Error('must not create a DB client')},
  fetcher:async()=>{outbound++;throw Error('must not fetch PayPal')}
 });
 const response=res();await handler(request(),response);
 assert.equal(response.statusCode,503);
 assert.equal(response.body?.error?.code,'CHECKOUT_NOT_AVAILABLE');
 assert.equal(outbound,0);
});
test('live webhook processing stays disabled until same-app webhook identity and live webhook flag are configured',async()=>{
 const disabled={...safeFixture};delete disabled.LUO_AGENT_LIVE_WEBHOOK_ENABLED;
 assert.equal(webhookReady(disabled,'paypal'),false);
 let outbound=0;const handler=createPaymentWebhookHandler({
  provider:'paypal',env:disabled,
  clientFactory:()=>{outbound++;throw Error('must not access ledger')},
  fetcher:async()=>{outbound++;throw Error('must not fetch PayPal')}
 });
 const result=res();await handler({method:'POST',headers:{},rawBody:Buffer.from('{"id":"EVT123"}')},result);
 assert.equal(result.statusCode,503);
 assert.equal(result.body?.error?.code,'WEBHOOK_NOT_CONFIGURED');
 assert.equal(outbound,0);
});
