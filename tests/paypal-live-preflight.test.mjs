import test from 'node:test';import assert from 'node:assert/strict';
import {paypalLiveConfigPresent,exactRegularPayPalPlan,verifyLivePayPalPlans,verifyLivePayPalWebhook,sameAppWebhook,LIVE_PAYPAL_WEBHOOK_PATH} from '../src/server/paypal-live-preflight.js';
const ids={starter:'P-4KE07040G5697374RNLPE3GI',pro:'P-1B27162996533990SNLPE64I',max:'P-51S06783TK159900ENLPE7SI'};
const env={LUO_PAYPAL_LIVE_CLIENT_ID:'example_live_client_id',LUO_PAYPAL_LIVE_CLIENT_SECRET:'example_private_secret',
 LUO_PAYPAL_PLAN_STANDARD_REGULAR:ids.starter,LUO_PAYPAL_PLAN_PRO_REGULAR:ids.pro,LUO_PAYPAL_PLAN_MAXIMUM_REGULAR:ids.max};
const expected={starter:'12.00',pro:'24.00',max:'30.00'};
function plan(tier){return {id:ids[tier],status:'ACTIVE',product_id:'PROD-ABC123456789',quantity_supported:false,
 billing_cycles:[{tenure_type:'REGULAR',total_cycles:0,sequence:1,frequency:{interval_unit:'MONTH',interval_count:1},
 pricing_scheme:{fixed_price:{currency_code:'USD',value:expected[tier]}}}],
 payment_preferences:{auto_bill_outstanding:false}}}
test('Live preflight requires operator credentials and only three regular plans, no discounts',()=>{
 assert.equal(paypalLiveConfigPresent({}),false);
 assert.equal(paypalLiveConfigPresent(env),true);
 assert.equal(paypalLiveConfigPresent({...env,LUO_PAYPAL_PLAN_PRO_REGULAR:'P-invalid'}),false);
 assert.equal(LIVE_PAYPAL_WEBHOOK_PATH,'/api/v1/billing/paypal-webhook');
});
test('Only verified active monthly USD prices 12/24/30 are acceptable',()=>{
 for(const [tier,id] of Object.entries(ids))assert.equal(exactRegularPayPalPlan(plan(tier),tier,{id}),true);
 for(const overridden of [
  {status:'CREATED'}, {billing_cycles:[]},{quantity_supported:true},
  {payment_preferences:{setup_fee:{currency_code:'USD',value:'2.00'}}}
 ])assert.equal(exactRegularPayPalPlan({...plan('starter'),...overridden},'starter',{id:ids.starter}),false);
 const p=plan('pro');p.billing_cycles[0].pricing_scheme.fixed_price.value='6.00';
 assert.equal(exactRegularPayPalPlan(p,'pro',{id:ids.pro}),false);
 const foreign=plan('max');foreign.id=ids.pro;
 assert.equal(exactRegularPayPalPlan(foreign,'max',{id:ids.max}),false);
});
test('Live API preflight can check merchant prices read-only, without opening a checkout',async()=>{
 const calls=[];
 const fetcher=async(url,init)=>{
  calls.push({url,method:init.method||'GET'});
  if(url.endsWith('/oauth2/token'))return {ok:true,json:async()=>({access_token:'mock_token_with_sufficient_length'})};
  const tier=Object.keys(ids).find(k=>url.endsWith(ids[k]));
  return{ok:true,json:async()=>plan(tier)};
 };
 const result=await verifyLivePayPalPlans({env,fetcher});
 assert.equal(result.ok,true);assert.deepEqual(result.plans.map(x=>x.valid),[true,true,true]);
 assert.equal(calls.length,4);assert.equal(calls[0].method,'POST');
 assert.ok(calls.slice(1).every(x=>x.method==='GET'));
 assert.ok(calls.every(x=>x.url.startsWith('https://api-m.paypal.com/')));
});
test('Wrong merchant currency, duplicate or changed plans cannot pass',async()=>{
 let n=0;
 const bad=async(url)=>{
  if(url.endsWith('/oauth2/token'))return{ok:true,json:async()=>({access_token:'mock_token_with_sufficient_length'})};
  const tier=Object.keys(ids)[n++],p=plan(tier);
  if(tier==='max')p.billing_cycles[0].pricing_scheme.fixed_price.value='9.00';
  return{ok:true,json:async()=>p};
 };
 const result=await verifyLivePayPalPlans({env,fetcher:bad});
 assert.equal(result.ok,false);assert.equal(result.reason,'PRICE_OR_PLAN_MISMATCH');
 assert.equal((await verifyLivePayPalPlans({env:{},fetcher:()=>{throw Error('should not run')}})).reason,'CONFIGURATION_INCOMPLETE');
});

test('A renamed SOAP webhook or unexpected URL never counts as the PayPal REST app listener',()=>{
 const w={id:'3H475085R9576554V',url:'https://luo-chat-luokai25.vercel.app/api/v1/billing/paypal-webhook',
 event_types:[
  'BILLING.SUBSCRIPTION.CREATED','BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'
 ].map(name=>({name}))};
 assert.equal(sameAppWebhook(w,{id:w.id,url:w.url}),true);
 assert.equal(sameAppWebhook({...w,url:'https://wrong.invalid/'},{id:w.id,url:w.url}),false);
 assert.equal(sameAppWebhook({...w,event_types:[{name:'PAYMENT.SALE.COMPLETED'}]},{id:w.id,url:w.url}),false);
});
test('App-specific remote check fails closed for SOAP webhook, and passes for a real REST-app webhook',async()=>{
 const webhookId='3H475085R9576554V',liveEnv={...env,LUO_PAYPAL_LIVE_WEBHOOK_ID:webhookId};
 const failure=await verifyLivePayPalWebhook({env:liveEnv,fetcher:async(url)=>{
  if(url.endsWith('/oauth2/token'))return{ok:true,json:async()=>({access_token:'safe_mock_paypal_live_token'})};
  return{ok:false,status:404};
 }});
 assert.equal(failure.ok,false);assert.equal(failure.reason,'WEBHOOK_NOT_IN_THIS_REST_APP');
 assert.equal((await verifyLivePayPalWebhook({env})).reason,'LIVE_REST_APP_WEBHOOK_NOT_CONFIGURED');
 const valid={id:webhookId,url:'https://luo-chat-luokai25.vercel.app/api/v1/billing/paypal-webhook',
 event_types:[{name:'*'}]};
 let calls=0;
 const success=await verifyLivePayPalWebhook({env:liveEnv,fetcher:async(url,init)=>{
  calls++;
  if(url.endsWith('/oauth2/token'))return{ok:true,json:async()=>({access_token:'safe_mock_paypal_live_token'})};
  assert.equal(init.method,undefined);
  assert.ok(url.endsWith('/v1/notifications/webhooks/'+webhookId));
  return{ok:true,json:async()=>valid};
 }});
 assert.equal(success.ok,true);
 assert.equal(calls,2);
});
