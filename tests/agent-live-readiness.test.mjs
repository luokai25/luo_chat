import test from 'node:test';
import assert from 'node:assert/strict';
import {agentRuntime,agentCheckoutOrigin,trustedAgentOrigin,isValidAgentOrigin,paypalMerchantSettings} from '../src/server/agent-environment.js';
import {checkoutReady} from '../src/server/agent-billing.js';
import {webhookReady} from '../src/server/agent-payment-webhooks.js';
import {registrationIsEnabled} from '../src/server/agent-registration.js';
import {paidAgentApiEnabled} from '../src/server/agent-account.js';
const origin='https://luo-chat-luokai25.vercel.app';
const prod={
 VERCEL_ENV:'production',LUO_AGENT_PRODUCTION_ENABLED:'true',
 LUO_AGENT_PRODUCTION_DATABASE_READY:'true',LUO_AGENT_LIVE_SECRET_ROTATED:'true',
 LUO_AGENT_BILLING_ENABLED:'true',LUO_AGENT_PAID_API_ENABLED:'true',
 LUO_AGENT_PENDING_REGISTRATION_ENABLED:'true',
 LUO_AGENT_LIVE_CHECKOUT_ENABLED:'true',LUO_AGENT_LIVE_WEBHOOK_ENABLED:'true',
 LUO_AGENT_SIGNUP_HASH_KEY:'f'.repeat(44),
 SUPABASE_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'server_owned_service_'.padEnd(55,'t'),
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_prod_'.padEnd(50,'p'),
 LUO_PAYPAL_LIVE_CLIENT_ID:'live_merchant_client_'.padEnd(45,'c'),
 LUO_PAYPAL_LIVE_CLIENT_SECRET:'live_merchant_secret_'.padEnd(45,'s'),
 LUO_PAYPAL_LIVE_WEBHOOK_ID:'3H475085R9576554V',
 LUO_PAYPAL_PLAN_STANDARD_REGULAR:'P-4KE07040G5697374RNLPE3GI',
 LUO_PAYPAL_PLAN_PRO_REGULAR:'P-1B27162996533990SNLPE64I',
 LUO_PAYPAL_PLAN_MAXIMUM_REGULAR:'P-51S06783TK159900ENLPE7SI'
};
test('production agent API requires independent explicit gates and is denied with real current Vercel configuration',()=>{
 assert.equal(agentRuntime({}),null);
 for(const key of ['LUO_AGENT_PRODUCTION_ENABLED','LUO_AGENT_PRODUCTION_DATABASE_READY','LUO_AGENT_LIVE_SECRET_ROTATED','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY']){
  const missing={...prod};delete missing[key];
  assert.equal(agentRuntime(missing),null,key);
  assert.equal(checkoutReady(missing,'paypal'),false,key);
  assert.equal(registrationIsEnabled(missing),false,key);
  assert.equal(paidAgentApiEnabled(missing),false,key);
  assert.equal(webhookReady(missing,'paypal'),false,key);
 }
 const changed={...prod,SUPABASE_URL:'https://itecovbwilcrvjqkdoyd.supabase.co'};
 assert.equal(agentRuntime(changed),null);
 assert.equal(checkoutReady({...prod,LUO_AGENT_LIVE_CHECKOUT_ENABLED:'false'},'paypal'),false);
 assert.equal(checkoutReady({...prod,LUO_AGENT_LIVE_WEBHOOK_ENABLED:'false'},'paypal'),false);
 assert.equal(checkoutReady({...prod,LUO_AGENT_PROMOTIONS_ENABLED:'true'},'paypal'),false);
 assert.equal(checkoutReady({...prod,LUO_PAYPAL_LIVE_CLIENT_SECRET:''},'paypal'),false);
 assert.equal(webhookReady({...prod,LUO_AGENT_LIVE_WEBHOOK_ENABLED:'false'},'paypal'),false);
});
test('a complete future verified live environment uses only production database and merchant REST API',()=>{
 const runtime=agentRuntime(prod);
 assert.equal(runtime?.mode,'live');
 assert.equal(runtime.url,'https://byjixqwpjvsgmqilmzbm.supabase.co');
 assert.equal(paypalMerchantSettings(prod).api,'https://api-m.paypal.com');
 assert.equal(paypalMerchantSettings(prod).approval,'https://www.paypal.com/');
 assert.equal(registrationIsEnabled(prod),true);
 assert.equal(paidAgentApiEnabled(prod),true);
 assert.equal(checkoutReady(prod,'paypal'),true);
 assert.equal(checkoutReady(prod,'stripe'),false);
 assert.equal(webhookReady(prod,'paypal'),true);
 assert.equal(webhookReady(prod,'stripe'),false);
});
test('production checkout requires exact main-domain host and same-origin policy',()=>{
 const valid={method:'POST',headers:{host:'luo-chat-luokai25.vercel.app',origin}};
 assert.equal(agentCheckoutOrigin(valid,prod),origin+'/');
 assert.equal(isValidAgentOrigin(valid,prod),true);
 assert.equal(trustedAgentOrigin(origin,prod),true);
 for(const h of ['evil.invalid','luo-chat-luokai25-a-luokai25s-projects.vercel.app','luo-chat-luokai25.vercel.app.evil.com']){
  assert.equal(agentCheckoutOrigin({headers:{host:h}},prod),null);
 }
 assert.equal(agentCheckoutOrigin({headers:{host:'luo-chat-luokai25.vercel.app:8443'}},prod),null);
 assert.equal(isValidAgentOrigin({...valid,headers:{origin:'https://evil.invalid'}},prod),false);
 assert.equal(isValidAgentOrigin({...valid,headers:{origin, 'sec-fetch-site':'cross-site'}},prod),false);
});
test('staging remains staging even if live PayPal environment vars are included by accident',()=>{
 const preview={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/reels-immersive-20261025',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'staging_service_'.padEnd(40,'s'),
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'staging_public_'.padEnd(40,'p'),LUO_PAYPAL_ENV:'sandbox',
 LUO_PAYPAL_CLIENT_ID:'sandbox_client_'.padEnd(40,'a'),
 LUO_PAYPAL_CLIENT_SECRET:'sandbox_secret_'.padEnd(40,'b'),
 LUO_AGENT_BILLING_ENABLED:'true',...Object.fromEntries(Object.entries(prod).filter(([key])=>key.startsWith('LUO_PAYPAL_LIVE')||key.startsWith('LUO_PAYPAL_PLAN_')))};
 assert.equal(agentRuntime(preview)?.mode,'sandbox');
 assert.equal(paypalMerchantSettings(preview)?.api,'https://api-m.sandbox.paypal.com');
 assert.equal(checkoutReady(preview,'paypal'),true);
 assert.equal(trustedAgentOrigin('https://luo-chat-luokai25-example12-luokai25s-projects.vercel.app',preview),true);
 assert.equal(trustedAgentOrigin(origin,preview),false);
});
