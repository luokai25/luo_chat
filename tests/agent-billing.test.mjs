import test from 'node:test';import assert from 'node:assert/strict';
import {createAgentCheckoutHandler,checkoutReady,stripeSessionForm,paypalPlanId} from '../src/server/agent-billing.js';
const base={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/reels-immersive-20261025',
 LUO_AGENT_BILLING_ENABLED:'true',LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'service_test_not_real_123456789000000000',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'sb_publishable_dummy_123456789000000000',
 LUO_STRIPE_SECRET_KEY:'sk_test_not_a_real_secret',
 LUO_STRIPE_PRICE_STANDARD:'price_123456789AAAA',
 LUO_STRIPE_PRICE_PRO:'price_123456789BBBB',
 LUO_STRIPE_PRICE_MAXIMUM:'price_123456789CCCC',
 LUO_STRIPE_COUPON_STANDARD:'coupon_10day_starter',
 LUO_STRIPE_COUPON_PRO:'coupon_10day_pro',
 LUO_STRIPE_COUPON_MAXIMUM:'coupon_10day_max',
 LUO_AGENT_PROMOTIONS_ENABLED:'true',
 LUO_AGENT_PROMO_START_AT:'2026-10-25T15:00:00Z'
};
function output(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
function request(overrides={}){return {method:'POST',headers:{'content-type':'application/json',host:'luo-chat-luokai25-abcdef12-luokai25s-projects.vercel.app'},body:{username:'hello_agent',password:'this passphrase is long enough',plan:'starter',provider:'stripe'},...overrides}}
const intent={intent_id:'77777777-7777-4777-8777-777777777777',agent_id:'11111111-1111-4111-8111-111111111111',plan:'starter',provider:'stripe',promo:true,regular_cents:1200,first_invoice_cents:300,existing_reference:null};
function clients(log){return (_url,key)=>key===base.LUO_AGENT_STAGING_SERVICE_ROLE_KEY?{rpc:async(name,args)=>{log.push([name,args]);if(name==='luo_agent_reserve_checkout')return{data:intent};if(name==='luo_agent_attach_checkout')return{data:true};return{error:{message:'bad'}}}}:{auth:{signInWithPassword:async()=>({data:{user:{id:'12345678-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}})}}}
test('checkout is off by default and cannot run with live Stripe key or production Vercel',()=>{
 assert.equal(checkoutReady({},'stripe'),false);assert.equal(checkoutReady(base,'stripe'),true);
 assert.equal(checkoutReady({...base,LUO_STRIPE_SECRET_KEY:'sk_live_anything'},'stripe'),false);
 assert.equal(checkoutReady({...base,VERCEL_ENV:'production'},'stripe'),false);
 assert.equal(checkoutReady({...base,LUO_AGENT_STAGING_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co'},'stripe'),false);
});
test('Stripe forms use server prices, promotion coupon and a single idempotent agent intent',async()=>{
 const events=[],mockFetch=async(url,init)=>{events.push([url,init]);return {ok:true,json:async()=>({id:'cs_test_abcdefgh1234',url:'https://checkout.stripe.com/c/pay/cs_test_dummy'})}};
 const out=output();await createAgentCheckoutHandler({env:base,clientFactory:clients(events),fetcher:mockFetch,now:()=>Date.parse('2026-10-25T15:01:00Z')})(request(),out);
 assert.equal(out.statusCode,201);assert.equal(out.body.first_invoice_price_usd,3);assert.equal(out.body.renews_monthly_usd,12);
 assert.equal(out.body.activation,'awaiting_verified_payment');
 const form=new URLSearchParams(events.find(x=>x[0]==='https://api.stripe.com/v1/checkout/sessions')[1].body);
 assert.equal(form.get('line_items[0][price]'),'price_123456789AAAA');assert.equal(form.get('discounts[0][coupon]'),'coupon_10day_starter');
 assert.equal(form.get('client_reference_id'),intent.intent_id);assert.equal(form.get('subscription_data[metadata][luo_agent]'),intent.agent_id);
 assert.deepEqual(events.filter(x=>x[0]==='luo_agent_attach_checkout')[0][1],{p_intent:intent.intent_id,p_reference:'cs_test_abcdefgh1234'});
});
test('malicious request or cross-origin never contacts payment provider',async()=>{
 const events=[],handler=createAgentCheckoutHandler({env:base,clientFactory:clients(events),fetcher:async()=>{throw Error('should not fetch')}});
 for(const override of [{headers:{'content-type':'application/json',host:'evil.example'}},
  {body:{...request().body,unit_amount:1}},{body:{...request().body,provider:'fake'}},
  {body:{...request().body,plan:'max',password:'too short'}}]){
  const out=output();await handler(request(override),out);assert.ok([400,403,503].includes(out.statusCode));
 }
 assert.equal(events.length,0);
});
test('PayPal plan values are only accepted when validated by server config',()=>{
 assert.equal(paypalPlanId({},'starter',true),null);
 assert.equal(paypalPlanId({LUO_PAYPAL_PLAN_STANDARD_PROMO:'P-ABCDEFGHI123456789'},'starter',true),'P-ABCDEFGHI123456789');
 assert.equal(paypalPlanId({LUO_PAYPAL_PLAN_STANDARD_PROMO:'https://evil.invalid'},'starter',true),null);
});
test('promotion prevents silently charging regular price while a discount is advertised',()=>{
 assert.throws(()=>stripeSessionForm({...intent,promo:true},{...base,LUO_STRIPE_COUPON_STANDARD:''},'https://luo-chat-luokai25-abc-luokai25s-projects.vercel.app/',Date.now()),/PROMO_NOT_CONFIGURED/);
});
