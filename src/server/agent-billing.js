// Hosted recurring checkout adapters. Production must not use staging credentials.
// Both processors are disabled until real merchant credentials and prices are configured.
import {createClient} from '@supabase/supabase-js';
import {normalizeAgentUsername,sendJson} from './agent-platform.js';
import {quoteAgentPlan,approvedStripePriceId,approvedStripeCouponId} from './agent-pricing.js';
const STAGING='https://itecovbwilcrvjqkdoyd.supabase.co';
const BRANCH='feature/reels-immersive-20261025';
const PREVIEW_HOST=/^luo-chat-luokai25-[a-z0-9]+-luokai25s-projects\.vercel\.app$/;
const safeOrigin=(origin)=>{try{const u=new URL(origin);return u.protocol==='https:'&&PREVIEW_HOST.test(u.hostname)&&u.pathname==='/'&&u.search===''&&u.hash===''}catch{return false}};
export function checkoutReady(env,provider){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||env.LUO_AGENT_BILLING_ENABLED!=='true'
    ||env.LUO_AGENT_STAGING_URL!==STAGING||typeof env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY!=='string'||env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY.length<32
    ||typeof env.LUO_AGENT_STAGING_PUBLISHABLE_KEY!=='string'||env.LUO_AGENT_STAGING_PUBLISHABLE_KEY.length<30)return false;
 if(provider==='stripe')return typeof env.LUO_STRIPE_SECRET_KEY==='string'&&env.LUO_STRIPE_SECRET_KEY.startsWith('sk_test_')
    &&['starter','pro','max'].every(plan=>!!approvedStripePriceId(env,plan));
 if(provider==='paypal')return env.LUO_PAYPAL_ENV==='sandbox'&&typeof env.LUO_PAYPAL_CLIENT_ID==='string'
   &&env.LUO_PAYPAL_CLIENT_ID.length>12&&typeof env.LUO_PAYPAL_CLIENT_SECRET==='string'
   &&env.LUO_PAYPAL_CLIENT_SECRET.length>20;
 return false;
}
export function paypalPlanId(env,plan,promo){
 const tier={starter:'STANDARD',pro:'PRO',max:'MAXIMUM'}[plan];
 if(!tier)return null;
 const id=env['LUO_PAYPAL_PLAN_'+tier+'_'+(promo?'PROMO':'REGULAR')];
 return typeof id==='string'&&/^P-[A-Z0-9-]{8,}$/.test(id)?id:null;
}
export function stripeSessionForm(intent,env,origin,now){
 const price=approvedStripePriceId(env,intent.plan);if(!price)throw Error('PRICE_UNCONFIGURED');
 const coupon=intent.promo?approvedStripeCouponId(env,intent.plan):null;
 if(intent.promo&&!coupon)throw Error('PROMO_NOT_CONFIGURED');
 const u=new URLSearchParams({
  mode:'subscription','line_items[0][price]':price,'line_items[0][quantity]':'1',
  client_reference_id:intent.intent_id,
  'metadata[luo_intent]':intent.intent_id,
  'subscription_data[metadata][luo_intent]':intent.intent_id,
  'subscription_data[metadata][luo_agent]':intent.agent_id,
  'subscription_data[metadata][luo_plan]':intent.plan,
  success_url:origin+'agents?checkout=processing&session_id={CHECKOUT_SESSION_ID}',
  cancel_url:origin+'agents?checkout=canceled',
  expires_at:String(Math.floor(now/1000)+3600)
 });
 if(coupon)u.set('discounts[0][coupon]',coupon);
 return u;
}
const jsonError=(res,status,code)=>sendJson(res,status,{error:{code}});
async function fetchJson(fetcher,url,init){
 const result=await fetcher(url,{...init,signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw Error('PROCESSOR_UNAVAILABLE');
 const body=await result.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error('PROCESSOR_INVALID');
 return body;
}
export async function paypalAccessToken(env,fetcher){
 const auth=Buffer.from(env.LUO_PAYPAL_CLIENT_ID+':'+env.LUO_PAYPAL_CLIENT_SECRET).toString('base64');
 const result=await fetchJson(fetcher,'https://api-m.sandbox.paypal.com/v1/oauth2/token',{
  method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},
  body:'grant_type=client_credentials'});
 if(typeof result.access_token!=='string'||result.access_token.length<20)throw Error('PAYPAL_AUTH_UNAVAILABLE');
 return result.access_token;
}
export function createAgentCheckoutHandler({env=process.env,clientFactory=createClient,fetcher=fetch,logger=console,now=Date.now}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return jsonError(res,405,'METHOD_NOT_ALLOWED')}
  if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return jsonError(res,415,'UNSUPPORTED_CONTENT_TYPE');
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>2048
    ||Object.keys(input).some(key=>!['username','password','plan','provider'].includes(key)))return jsonError(res,400,'INVALID_BODY');
  if(!['stripe','paypal'].includes(input.provider)||!checkoutReady(env,input.provider)){
   res.setHeader('Retry-After','86400');return jsonError(res,503,'CHECKOUT_NOT_AVAILABLE');
  }
  const username=normalizeAgentUsername(input.username);
  if(!username||typeof input.password!=='string'||input.password.length<15||input.password.length>128
   ||!['starter','pro','max'].includes(input.plan))return jsonError(res,400,'INVALID_CHECKOUT');
  const expectedOrigin='https://'+req.headers?.host+'/';
  if(!safeOrigin(expectedOrigin)||req.headers?.origin&&req.headers.origin!==expectedOrigin.slice(0,-1)
    ||req.headers?.['sec-fetch-site']==='cross-site')return jsonError(res,403,'UNTRUSTED_ORIGIN');
  const db=clientFactory(STAGING,env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
   const auth=clientFactory(STAGING,env.LUO_AGENT_STAGING_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   const signed=await auth.auth.signInWithPassword({email:'agent+'+username+'@agents.luo.invalid',password:input.password});
   if(signed.error||!signed.data?.user?.id)return jsonError(res,401,'INVALID_CREDENTIALS');
   const quote=quoteAgentPlan(input.plan,{now:now(),promoStart:env.LUO_AGENT_PROMO_START_AT});
   // A promo checkout is denied if its provider-specific first-invoice contract
   // has not been configured; never silently charge the normal price instead.
   if(input.provider==='paypal'&&!paypalPlanId(env,input.plan,quote.offer_active))return jsonError(res,503,'PAYPAL_PLAN_UNCONFIGURED');
   if(input.provider==='stripe'&&quote.offer_active&&!approvedStripeCouponId(env,input.plan))return jsonError(res,503,'PROMO_NOT_CONFIGURED');
   const intent=await db.rpc('luo_agent_reserve_checkout',{p_auth_user:signed.data.user.id,p_plan:input.plan,p_provider:input.provider,p_promo:quote.offer_active});
   if(intent.error){
    if(['23505','28000'].includes(intent.error.code))return jsonError(res,409,'CHECKOUT_NOT_ELIGIBLE');
    throw Error('CHECKOUT_RESERVATION_FAILED');
   }
   if(!intent.data||intent.data.first_invoice_cents!==quote.first_invoice_price*100||intent.data.regular_cents!==quote.monthly_price*100)throw Error('CHECKOUT_PRICE_MISMATCH');
   const i=intent.data;
   let approval,external;
   if(input.provider==='stripe'){
    if(i.existing_reference){
     const session=await fetchJson(fetcher,'https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(i.existing_reference),{headers:{Authorization:'Bearer '+env.LUO_STRIPE_SECRET_KEY}});
     if(session.client_reference_id!==i.intent_id||session.status!=='open'||typeof session.url!=='string')throw Error('CHECKOUT_NOT_REUSABLE');
     approval=session.url;external=i.existing_reference;
    }else{
     const form=stripeSessionForm(i,env,expectedOrigin,now());
     const session=await fetchJson(fetcher,'https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',headers:{Authorization:'Bearer '+env.LUO_STRIPE_SECRET_KEY,
       'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'luo-agent-'+i.intent_id},
      body:form.toString()});
     if(!/^cs_(?:test_|live_)[A-Za-z0-9]+$/.test(session.id||'')||typeof session.url!=='string'||!session.url.startsWith('https://checkout.stripe.com/'))throw Error('STRIPE_RESPONSE_INVALID');
     approval=session.url;external=session.id;
    }
   }else{
    const accessToken=await paypalAccessToken(env,fetcher);
    if(i.existing_reference){
     const sub=await fetchJson(fetcher,'https://api-m.sandbox.paypal.com/v1/billing/subscriptions/'+encodeURIComponent(i.existing_reference),{headers:{Authorization:'Bearer '+accessToken}});
     if(sub.custom_id!==i.intent_id)throw Error('CHECKOUT_NOT_REUSABLE');
     approval=sub.links?.find(v=>v.rel==='approve')?.href;external=i.existing_reference;
    }else{
     const sub=await fetchJson(fetcher,'https://api-m.sandbox.paypal.com/v1/billing/subscriptions',{
      method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json','PayPal-Request-Id':i.intent_id},
      body:JSON.stringify({plan_id:paypalPlanId(env,input.plan,i.promo),custom_id:i.intent_id,
       application_context:{brand_name:'Luo Chat',user_action:'SUBSCRIBE_NOW',
       return_url:expectedOrigin+'agents?checkout=processing',cancel_url:expectedOrigin+'agents?checkout=canceled'}})});
     approval=sub.links?.find(v=>v.rel==='approve')?.href;external=sub.id;
    }
    if(typeof external!=='string'||!/^I-[A-Za-z0-9]{8,}$/.test(external)||typeof approval!=='string'||!approval.startsWith('https://www.sandbox.paypal.com/'))throw Error('PAYPAL_RESPONSE_INVALID');
   }
   const bound=await db.rpc('luo_agent_attach_checkout',{p_intent:i.intent_id,p_reference:external});
   if(bound.error||bound.data!==true)throw Error('CHECKOUT_BIND_FAILED');
   return sendJson(res,201,{provider:input.provider,checkout_url:approval,intent_id:i.intent_id,
    first_invoice_price_usd:quote.first_invoice_price,renews_monthly_usd:quote.renewal_monthly_price,
    currency:'USD',promotion:quote.offer_active?'first_invoice_only':'none',
    activation:'awaiting_verified_payment',no_success_url_activation:true});
  }catch{
   logger.error('LUO_AGENT_CHECKOUT_FAILED');
   return jsonError(res,503,'CHECKOUT_UNAVAILABLE');
  }
 };
}
