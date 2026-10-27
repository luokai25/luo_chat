import {paypalCashEvidence} from './workspace-controls.js';
// Verified, reconciled provider webhooks. Disabled by default for staging.
// Never trust a success redirect, a webhook claim alone, or client-provided plan.
import {createClient} from '@supabase/supabase-js';
import {verifyStripeWebhook,paymentNeedsReconciliation} from './stripe-webhook-verifier.js';
import {checkoutReady,paypalAccessToken,paypalPlanId} from './agent-billing.js';
import {approvedStripePriceId} from './agent-pricing.js';
import {sendJson} from './agent-platform.js';
import {agentRuntime,paypalMerchantSettings} from './agent-environment.js';
import {verifyLivePayPalWebhook} from './paypal-live-preflight.js';
const hexId=/^[a-f0-9-]{36}$/i;
export async function readWebhookBytes(req){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody.length<=65536?req.rawBody:null;
 let total=0;const chunks=[];
 try{for await(const chunk of req){total+=chunk.length;if(total>65536)return null;chunks.push(chunk)}return Buffer.concat(chunks)}catch{return null}
}
export function webhookReady(env,provider){
 const runtime=agentRuntime(env);
 if(!runtime)return false;
 if(runtime.mode==='live')return provider==='paypal'
  &&env.LUO_AGENT_LIVE_WEBHOOK_ENABLED==='true'
  &&!!paypalMerchantSettings(env)
  &&typeof env.LUO_PAYPAL_LIVE_WEBHOOK_ID==='string'
  &&/^[A-Za-z0-9]{12,48}$/.test(env.LUO_PAYPAL_LIVE_WEBHOOK_ID);
 if(!checkoutReady(env,provider))return false;
 if(provider==='stripe')return env.LUO_AGENT_STRIPE_WEBHOOK_ENABLED==='true'
  &&typeof env.LUO_STRIPE_WEBHOOK_SECRET==='string'&&/^whsec_[A-Za-z0-9_]{16,}$/.test(env.LUO_STRIPE_WEBHOOK_SECRET);
 return env.LUO_AGENT_PAYPAL_WEBHOOK_ENABLED==='true'
   &&typeof env.LUO_PAYPAL_WEBHOOK_ID==='string'&&env.LUO_PAYPAL_WEBHOOK_ID.length>=8;
}
const none=(res)=>sendJson(res,200,{received:true,activation:false});
async function remoteJson(fetcher,url,init){
 const r=await fetcher(url,{...init,signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('REMOTE_RECONCILIATION_FAILED');const j=await r.json();
 if(!j||typeof j!=='object'||Array.isArray(j))throw Error('REMOTE_RESPONSE_INVALID');
 return j;
}
function stripeGet(fetcher,env,path){return remoteJson(fetcher,'https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+env.LUO_STRIPE_SECRET_KEY}})}
function idFromStripeEvent(event){
 const item=event.data?.object;
 if(event.type.startsWith('customer.subscription.'))return item?.id;
 if(event.type.startsWith('checkout.session.'))return item?.subscription;
 if(event.type.startsWith('invoice.'))return typeof item?.subscription==='string'?item.subscription:item?.parent?.subscription_details?.subscription;
 return null;
}
export function stripePaidEvidence({intent,subscription,session,invoice,priceId}){
 if(!intent||!subscription||!session||!invoice||!priceId)return null;
 const item=subscription.items?.data;
 if(!Array.isArray(item)||item.length!==1)return null;
 const price=item[0].price;
 const until=item[0].current_period_end||subscription.current_period_end;
 if(!Number.isSafeInteger(until)||until*1000<=Date.now())return null;
 if(subscription.status!=='active'||subscription.currency&&subscription.currency!=='usd'
  ||subscription.metadata?.luo_intent!==intent.id
  ||subscription.metadata?.luo_agent!==intent.agent_id
  ||subscription.metadata?.luo_plan!==intent.plan
  ||session.id!==intent.reference||session.client_reference_id!==intent.id
  ||session.mode!=='subscription'||session.status!=='complete'||session.payment_status!=='paid'
  ||session.subscription!==subscription.id||session.customer!==subscription.customer
  ||price?.id!==priceId||price?.currency!=='usd'||price?.unit_amount!==intent.regular_cents
  ||price?.recurring?.interval!=='month'||price?.recurring?.interval_count!==1||item[0].quantity!==1
  ||invoice.paid!==true||invoice.status!=='paid'||invoice.subscription&&invoice.subscription!==subscription.id
  ||typeof invoice.amount_paid!=='number'
  ||![intent.first_invoice_cents,intent.regular_cents].includes(invoice.amount_paid)
  )return null;
 return {subscription:subscription.id,customer:subscription.customer,price:price.id,
 amount:invoice.amount_paid,paidThrough:new Date(until*1000).toISOString()};
}
async function handleStripe(event,db,env,fetcher){
 if(!paymentNeedsReconciliation(event))return 'ignored';
 const subId=idFromStripeEvent(event);
 if(typeof subId!=='string'||!/^sub_[A-Za-z0-9]+$/.test(subId))return 'ignored';
 const sub=await stripeGet(fetcher,env,'subscriptions/'+encodeURIComponent(subId));
 const intentId=sub.metadata?.luo_intent;
 if(typeof intentId!=='string'||!hexId.test(intentId))return 'ignored';
 const loaded=await db.rpc('luo_agent_checkout_snapshot',{p_intent:intentId,p_provider:'stripe'});
 if(loaded.error)throw Error('SNAPSHOT_UNAVAILABLE');
 const intent=loaded.data;
 if(!intent||!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(intent.reference||''))return 'ignored';
 // A Stripe-signed cancellation event still needs confirmation against provider state.
 if(['canceled','unpaid','past_due','paused'].includes(sub.status)){
  const suspended=await db.rpc('luo_agent_suspend_paid_identity',{p_provider:'stripe',p_subscription:sub.id,p_event:event.id,p_state:sub.status});
  if(suspended.error)throw Error('CANCEL_RECONCILIATION_FAILED');
  return suspended.data;
 }
 if(sub.status!=='active')return 'ignored';
 const session=await stripeGet(fetcher,env,'checkout/sessions/'+encodeURIComponent(intent.reference));
 const invoiceId=typeof sub.latest_invoice==='string'?sub.latest_invoice:sub.latest_invoice?.id;
 if(typeof invoiceId!=='string'||!/^in_[A-Za-z0-9]+$/.test(invoiceId))return 'ignored';
 const invoice=await stripeGet(fetcher,env,'invoices/'+encodeURIComponent(invoiceId));
 const proof=stripePaidEvidence({intent,subscription:sub,session,invoice,priceId:approvedStripePriceId(env,intent.plan)});
 if(!proof)return 'ignored';
 const applied=await db.rpc('luo_agent_record_reconciled_checkout',{
  p_intent:intent.id,p_provider:'stripe',p_reference:intent.reference,p_event:event.id,
  p_event_type:event.type,p_subscription:proof.subscription,p_customer:proof.customer,
  p_price:proof.price,p_amount:proof.amount,p_paid_through:proof.paidThrough
 });
 if(applied.error)throw Error('DB_RECONCILIATION_FAILED');
 return applied.data;
}
function paypalSubscriptionId(event){
 if(event.event_type?.startsWith('BILLING.SUBSCRIPTION.'))return event.resource?.id;
 return event.resource?.billing_agreement_id||event.resource?.supplementary_data?.related_ids?.subscription_id;
}
export function paypalPaidEvidence({intent,subscription,transactions,planId}){
 if(!intent||!subscription||!Array.isArray(transactions)||!planId)return null;
 if(subscription.custom_id!==intent.id||subscription.plan_id!==planId||subscription.status!=='ACTIVE'||subscription.id!==intent.reference)return null;
 const paidAt=subscription.billing_info?.last_payment?.time;
 const next=subscription.billing_info?.next_billing_time;
 if(typeof paidAt!=='string'||!Number.isFinite(Date.parse(paidAt))||typeof next!=='string'||Date.parse(next)<=Date.now())return null;
 const eligible=transactions.find(x=>{
  const price=x.amount_with_breakdown?.gross_amount||x.amount;
  const amount=Number(price?.value);
  return x.status==='COMPLETED'&&price?.currency_code==='USD'
  &&Number.isFinite(amount)&&Math.round(amount*100)===amount*100
  &&[intent.first_invoice_cents,intent.regular_cents].includes(Math.round(amount*100))
  &&Math.abs(Date.parse(x.time||x.create_time)-Date.parse(paidAt))<14*86400000;
 });
 if(!eligible)return null;
 return {subscription:subscription.id,customer:subscription.subscriber?.payer_id,
 price:subscription.plan_id,amount:Math.round(Number((eligible.amount_with_breakdown?.gross_amount||eligible.amount).value)*100),
 paidThrough:new Date(next).toISOString()};
}
async function handlePayPal(event,db,env,fetcher){
 if(!['BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.UPDATED','BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED','PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(event.event_type))return 'ignored';
 const subId=paypalSubscriptionId(event);
 if(typeof subId!=='string'||!/^I-[A-Za-z0-9]+$/.test(subId))return 'ignored';
 const access=await paypalAccessToken(env,fetcher);
 const auth={Authorization:'Bearer '+access};
 const sub=await remoteJson(fetcher,paypalMerchantSettings(env).api+'/v1/billing/subscriptions/'+encodeURIComponent(subId),{headers:auth});
 const intentId=sub.custom_id;
 if(typeof intentId!=='string'||!hexId.test(intentId))return 'ignored';
 const record=await db.rpc('luo_agent_checkout_snapshot',{p_intent:intentId,p_provider:'paypal'});
 if(record.error)throw Error('PAYPAL_SNAPSHOT_UNAVAILABLE');
 const intent=record.data;
 if(!intent||intent.reference!==sub.id)return 'ignored';
 // A verified refund/reversal must never re-grant access from an old sale.
 // Confirm the subscription belongs to this checkout before removing access.
 const reversed=['PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(event.event_type);
 if(reversed||['CANCELLED','SUSPENDED','EXPIRED'].includes(sub.status)){
  const state=reversed||sub.status==='SUSPENDED'?'paused':'canceled';
  const applied=await db.rpc('luo_agent_suspend_paid_identity',{p_provider:'paypal',p_subscription:sub.id,p_event:event.id,p_state:state});
  if(applied.error)throw Error('PAYPAL_SUSPENSION_UNAVAILABLE');return applied.data;
 }
 if(sub.status!=='ACTIVE')return 'ignored';
 const now=new Date(),then=new Date(now.getTime()-100*86400000);
 const end=new Date(now.getTime()+86400000);
 const params='?start_time='+encodeURIComponent(then.toISOString())+'&end_time='+encodeURIComponent(end.toISOString());
 const paid=await remoteJson(fetcher,paypalMerchantSettings(env).api+'/v1/billing/subscriptions/'+encodeURIComponent(sub.id)+'/transactions'+params,{headers:auth});
 const proof=paypalPaidEvidence({intent,subscription:sub,transactions:paid.transactions,planId:paypalPlanId(env,intent.plan,intent.promo)});
 if(!proof||typeof proof.customer!=='string')return 'ignored';
 const applied=await db.rpc('luo_agent_record_reconciled_checkout',{
 p_intent:intent.id,p_provider:'paypal',p_reference:intent.reference,p_event:event.id,
 p_event_type:event.event_type,p_subscription:proof.subscription,p_customer:proof.customer,
 p_price:proof.price,p_amount:proof.amount,p_paid_through:proof.paidThrough
 });
 if(applied.error)throw Error('PAYPAL_RECONCILIATION_FAILED');
 if(env.LUO_WORKSPACE_CONTROLS_ENABLED==='true'){
  const records=paypalCashEvidence(paid.transactions,intent);
  if(!records.length)throw Error('PAYPAL_CASH_EVIDENCE_MISSING');
  for(const t of records){const cash=await db.rpc('luo_agent_record_cash',{p_transaction:t.id,p_subscription:sub.id,p_gross:t.gross,p_fee:t.fee,p_net:t.net,p_paid_at:t.time});if(cash.error)throw Error('PAYPAL_CASH_LEDGER_RETRY');}
 }
 return applied.data;
}
export function createPaymentWebhookHandler({provider='stripe',env=process.env,fetcher=fetch,clientFactory=createClient,logger=console}={}){
 if(!['stripe','paypal'].includes(provider))throw Error('Invalid processor');
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED'}})}
  if(!webhookReady(env,provider))return sendJson(res,503,{error:{code:'WEBHOOK_NOT_CONFIGURED'}});
  const raw=await readWebhookBytes(req);
  if(!raw)return sendJson(res,413,{error:{code:'WEBHOOK_TOO_LARGE'}});
  let event;
  if(provider==='stripe'){
   event=verifyStripeWebhook({rawBody:raw,signature:req.headers?.['stripe-signature'],secret:env.LUO_STRIPE_WEBHOOK_SECRET});
   if(!event)return sendJson(res,400,{error:{code:'INVALID_WEBHOOK_SIGNATURE'}});
  }else{
   try{event=JSON.parse(raw.toString('utf8'))}catch{return sendJson(res,400,{error:{code:'INVALID_WEBHOOK_JSON'}})}
   if(!event||typeof event!=='object'||Array.isArray(event)||typeof event.id!=='string')return sendJson(res,400,{error:{code:'INVALID_WEBHOOK_EVENT'}});
   const fields=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];
   if(fields.some(k=>typeof req.headers?.[k]!=='string'||!req.headers[k].trim()||req.headers[k].length>4096))
    return sendJson(res,400,{error:{code:'INVALID_WEBHOOK_SIGNATURE'}});
   try{
   // Confirm the event is registered under the same app used to obtain this token.
   // A renamed NVP/SOAP special-app webhook cannot satisfy this check.
   if(agentRuntime(env).mode==='live'){
    const sameApp=await verifyLivePayPalWebhook({env,fetcher});
    if(!sameApp.ok)return sendJson(res,503,{error:{code:'PAYPAL_LIVE_WEBHOOK_IDENTITY_UNVERIFIED'}});
   }
   const access=await paypalAccessToken(env,fetcher);
   const verification=await remoteJson(fetcher,paypalMerchantSettings(env).api+'/v1/notifications/verify-webhook-signature',{
    method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
    body:JSON.stringify({auth_algo:req.headers?.['paypal-auth-algo'],cert_url:req.headers?.['paypal-cert-url'],
     transmission_id:req.headers?.['paypal-transmission-id'],transmission_sig:req.headers?.['paypal-transmission-sig'],
     transmission_time:req.headers?.['paypal-transmission-time'],webhook_id:agentRuntime(env).mode==='live'?env.LUO_PAYPAL_LIVE_WEBHOOK_ID:env.LUO_PAYPAL_WEBHOOK_ID,webhook_event:event})
   });
   if(verification.verification_status!=='SUCCESS')return sendJson(res,400,{error:{code:'INVALID_WEBHOOK_SIGNATURE'}});
   }catch{logger.error('LUO_PAYPAL_VERIFICATION_UNAVAILABLE');return sendJson(res,503,{error:{code:'VERIFICATION_RETRY'}})}
  }
  try{
   const runtime=agentRuntime(env);
   const db=clientFactory(runtime.url,runtime.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const result=provider==='stripe'?await handleStripe(event,db,env,fetcher):await handlePayPal(event,db,env,fetcher);
   return sendJson(res,200,{received:true,activation:result==='active',result});
  }catch{logger.error('LUO_AGENT_WEBHOOK_RECONCILIATION_FAILED');return sendJson(res,503,{error:{code:'RECONCILIATION_RETRY'}})}
 };
}
