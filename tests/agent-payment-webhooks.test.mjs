import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {createPaymentWebhookHandler,stripePaidEvidence,paypalPaidEvidence,webhookReady} from '../src/server/agent-payment-webhooks.js';
const nowSec=Math.floor(Date.now()/1000),paidThrough=nowSec+86400*30;
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/reels-immersive-20261025',
 LUO_AGENT_BILLING_ENABLED:'true',LUO_AGENT_STRIPE_WEBHOOK_ENABLED:'true',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fixture_service_key_1234567890123456789',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'sb_publishable_fake_1234567890123456789',
 LUO_STRIPE_SECRET_KEY:'sk_test_only_fixture',
 LUO_STRIPE_WEBHOOK_SECRET:'whsec_only_test_fixture_123456789',
 LUO_STRIPE_PRICE_STANDARD:'price_standard123456789',
 LUO_STRIPE_PRICE_PRO:'price_pro123456789',
 LUO_STRIPE_PRICE_MAXIMUM:'price_max123456789'
};
const intent={id:'77777777-7777-4777-8777-777777777777',
 agent_id:'11111111-1111-4111-8111-111111111111',plan:'starter',regular_cents:1200,first_invoice_cents:300,reference:'cs_test_abcdefg1234',promo:true,status:'pending'};
const sub={id:'sub_example123',customer:'cus_example123',status:'active',metadata:{luo_intent:intent.id,luo_agent:intent.agent_id,luo_plan:intent.plan},items:{data:[{quantity:1,current_period_end:paidThrough,price:{id:'price_standard123456789',unit_amount:1200,currency:'usd',recurring:{interval:'month',interval_count:1}}}]},latest_invoice:'in_example123'};
const session={id:intent.reference,client_reference_id:intent.id,subscription:sub.id,customer:sub.customer,status:'complete',payment_status:'paid',mode:'subscription'};
const invoice={id:'in_example123',paid:true,status:'paid',subscription:sub.id,amount_paid:300};
function res(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
function sign(raw,secret=env.LUO_STRIPE_WEBHOOK_SECRET){return 't='+nowSec+',v1='+createHmac('sha256',secret).update(nowSec+'.').update(raw).digest('hex')}
test('webhook is disabled without safe staging configuration',()=>{assert.equal(webhookReady({},'stripe'),false);assert.equal(webhookReady({...env,VERCEL_ENV:'production'},'stripe'),false);assert.equal(webhookReady(env,'stripe'),true)});
test('strict provider reconciling refuses wrong person, unpaid invoice, mismatch, stale period, extra units and false price',()=>{
 const valid={intent,subscription:sub,session,invoice,priceId:'price_standard123456789'};
 assert.equal(stripePaidEvidence(valid).amount,300);
 for(const change of [{session:{...session,client_reference_id:'other'}},{invoice:{...invoice,paid:false}},{invoice:{...invoice,amount_paid:900}},{subscription:{...sub,metadata:{luo_intent:'fake'}}},{subscription:{...sub,items:{data:[{...sub.items.data[0],quantity:2}]}}},{priceId:'price_other'},{subscription:{...sub,items:{data:[{...sub.items.data[0],current_period_end:nowSec-1}]}}}])assert.equal(stripePaidEvidence({...valid,...change}),null);
});
test('Stripe raw webhook signature and remote subscription, checkout and invoice reconciliation are all required',async()=>{
 const event={id:'evt_example0123',type:'checkout.session.completed',data:{object:{subscription:sub.id}}};
 const raw=Buffer.from(JSON.stringify(event)),calls=[];
 const fetcher=async url=>{calls.push(['get',url]);return{ok:true,json:async()=>url.includes('subscriptions/')?sub:url.includes('checkout/sessions/')?session:invoice}};
 const db={rpc:async (name,args)=>{calls.push([name,args]);if(name==='luo_agent_checkout_snapshot')return {data:intent};if(name==='luo_agent_record_reconciled_checkout')return {data:'active'};return{error:{code:'unknown'}}}};
 const handler=createPaymentWebhookHandler({env,clientFactory:()=>db,fetcher});
 const out=res();await handler({method:'POST',rawBody:raw,headers:{'stripe-signature':sign(raw)}},out);
 assert.equal(out.statusCode,200);assert.equal(out.body.activation,true);
 const proof=calls.find(x=>x[0]==='luo_agent_record_reconciled_checkout')[1];
 assert.equal(proof.p_intent,intent.id);assert.equal(proof.p_amount,300);
 assert.equal(proof.p_subscription,sub.id);assert.equal(proof.p_price,'price_standard123456789');
 assert.equal(calls.filter(x=>x[0]==='get').length,3);
});
test('unsigned or forged webhook is never reconciled or trusted',async()=>{
 const raw=Buffer.from(JSON.stringify({id:'evt_example0123',type:'invoice.paid',data:{object:{subscription:sub.id}}}));
 let n=0;const handler=createPaymentWebhookHandler({env,clientFactory:()=>{n++;throw Error('should not be accessed')},fetcher:async()=>{n++;throw Error('should not fetch')}});
 for(const signature of ['not-a-stripe-signature',sign(raw,'whsec_a_different_long_secret')]){const out=res();await handler({method:'POST',rawBody:raw,headers:{'stripe-signature':signature}},out);assert.equal(out.statusCode,400)}
 assert.equal(n,0);
});
test('PayPal evidence requires active subscription, matching plan, settled USD transaction and future renewal',()=>{
 const iso=new Date().toISOString(),future=new Date(Date.now()+30*86400000).toISOString();
 const intent={id:'77777777-7777-4777-8777-777777777777',reference:'I-ABCDEF12345',first_invoice_cents:300,regular_cents:1200};
 const subscription={id:intent.reference,custom_id:intent.id,status:'ACTIVE',plan_id:'P-ABCDEFG123456',subscriber:{payer_id:'payer_abcd'},billing_info:{last_payment:{time:iso},next_billing_time:future}};
 const tx={status:'COMPLETED',time:iso,amount:{currency_code:'USD',value:'3.00'}};
 const valid={intent,subscription,transactions:[tx],planId:subscription.plan_id};
 assert.equal(paypalPaidEvidence(valid).amount,300);
 assert.equal(paypalPaidEvidence({...valid,transactions:[{...tx,amount:{currency_code:'USD',value:'1.00'}}]}),null);
 assert.equal(paypalPaidEvidence({...valid,subscription:{...subscription,status:'APPROVAL_PENDING'}}),null);
 assert.equal(paypalPaidEvidence({...valid,planId:'P-OTHER'}),null);
});
const ppEnv={...env,LUO_PAYPAL_ENV:'sandbox',LUO_AGENT_PAYPAL_WEBHOOK_ENABLED:'true',LUO_PAYPAL_WEBHOOK_ID:'test_webhook_id_123',LUO_PAYPAL_CLIENT_ID:'sandbox_client_'.padEnd(45,'c'),LUO_PAYPAL_CLIENT_SECRET:'sandbox_secret_'.padEnd(45,'s'),LUO_PAYPAL_PLAN_STANDARD_REGULAR:'P-STANDARD123456',LUO_PAYPAL_PLAN_PRO_REGULAR:'P-PRO123456789',LUO_PAYPAL_PLAN_MAXIMUM_REGULAR:'P-MAX123456789'};
const ppHeaders=Object.fromEntries(['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'].map(k=>[k,'fixture']));
const ppIntent={...intent,reference:'I-ABCDEF12345',promo:false,first_invoice_cents:1200};
const ppSub={id:ppIntent.reference,custom_id:intent.id,status:'ACTIVE',plan_id:ppEnv.LUO_PAYPAL_PLAN_STANDARD_REGULAR,subscriber:{payer_id:'PAYER12345'},billing_info:{last_payment:{time:new Date().toISOString()},next_billing_time:new Date(Date.now()+30*86400000).toISOString()}};
function ppFixture({transactions,status='ACTIVE',snapshot=ppIntent,verificationError=false}={}){
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='luo_agent_checkout_snapshot'?snapshot:name==='luo_agent_suspend_paid_identity'?'paused':'active'}}};
 const fetcher=async(url)=>{
  calls.push(['fetch',url]);
  if(verificationError)throw Error('provider down');
  return {ok:true,json:async()=>url.endsWith('/token')?{access_token:'fixture_token_'.padEnd(40,'x')}:url.includes('verify-webhook-signature')?{verification_status:'SUCCESS'}:url.includes('/transactions?')?{transactions:transactions??[{id:'TX1234',status:'COMPLETED',time:ppSub.billing_info.last_payment.time,amount:{value:'12.00',currency_code:'USD'}}]}:{...ppSub,status}};
 };
 return {calls,handler:createPaymentWebhookHandler({provider:'paypal',env:ppEnv,clientFactory:()=>db,fetcher,logger:{error(){}}})};
}
async function ppDeliver(handler,type,headers=ppHeaders){const out=res();await handler({method:'POST',headers,rawBody:Buffer.from(JSON.stringify({id:'WH-EVENT12345',event_type:type,resource:{id:ppSub.id,billing_agreement_id:ppSub.id}}))},out);return out}
test('PayPal missing verification headers make no provider or database requests',async()=>{
 const {handler,calls}=ppFixture();const out=await ppDeliver(handler,'PAYMENT.SALE.COMPLETED',{});assert.equal(out.statusCode,400);assert.deepEqual(calls,[]);
});
test('PayPal verification outages request retry and never grant access',async()=>{
 const {handler,calls}=ppFixture({verificationError:true});const out=await ppDeliver(handler,'PAYMENT.SALE.COMPLETED');assert.equal(out.statusCode,503);assert.equal(out.body.error.code,'VERIFICATION_RETRY');assert.equal(calls.some(x=>x[0].startsWith('luo_agent')),false);
});
test('authenticated refunds and reversals suspend the matching identity even while subscription remains ACTIVE',async()=>{
 for(const type of ['PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED']){
  const {handler,calls}=ppFixture();const out=await ppDeliver(handler,type);
  assert.equal(out.statusCode,200);assert.equal(out.body.activation,false);
  assert.equal(calls.filter(x=>x[0]==='luo_agent_suspend_paid_identity').length,1);
  assert.equal(calls.find(x=>x[0]==='luo_agent_suspend_paid_identity')[1].p_state,'paused');
  assert.equal(calls.some(x=>x[0]==='luo_agent_record_reconciled_checkout'),false);
 }
});
test('PayPal events cannot suspend an unrelated checkout or activate refunded transactions',async()=>{
 const unrelated=ppFixture({snapshot:{...ppIntent,reference:'I-UNRELATED123'}});await ppDeliver(unrelated.handler,'PAYMENT.SALE.REFUNDED');assert.equal(unrelated.calls.some(x=>x[0]==='luo_agent_suspend_paid_identity'),false);
 const refunded=ppFixture({transactions:[{status:'REFUNDED',time:ppSub.billing_info.last_payment.time,amount:{value:'12.00',currency_code:'USD'}}]});const out=await ppDeliver(refunded.handler,'PAYMENT.SALE.COMPLETED');assert.equal(out.body.activation,false);assert.equal(refunded.calls.some(x=>x[0]==='luo_agent_record_reconciled_checkout'),false);
});
test('PayPal settled payment alone activates and cancellation removes access',async()=>{
 const paid=ppFixture();const out=await ppDeliver(paid.handler,'PAYMENT.SALE.COMPLETED');assert.equal(out.body.activation,true);assert.equal(paid.calls.find(x=>x[0]==='luo_agent_record_reconciled_checkout')[1].p_amount,1200);
 const canceled=ppFixture({status:'CANCELLED'});const ended=await ppDeliver(canceled.handler,'BILLING.SUBSCRIPTION.CANCELLED');assert.equal(ended.body.activation,false);assert.equal(canceled.calls.find(x=>x[0]==='luo_agent_suspend_paid_identity')[1].p_state,'canceled');
});
