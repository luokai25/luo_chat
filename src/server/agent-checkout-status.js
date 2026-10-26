// Read-only checkout recovery, with no processor POST and no new charges.
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {normalizeAgentUsername,sendJson} from './agent-platform.js';
import {agentRuntime,agentCheckoutOrigin,paypalMerchantSettings} from './agent-environment.js';
import {checkoutReady,paypalAccessToken} from './agent-billing.js';
const error=(res,status,code)=>sendJson(res,status,{error:{code}});
async function remote(fetcher,url,token){
 const response=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('PAYMENT_STATUS_NOT_AVAILABLE');
 return response.json();
}
export function createAgentCheckoutStatusHandler({env=process.env,clientFactory=createClient,fetcher=fetch,logger=console}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return error(res,405,'METHOD_NOT_ALLOWED')}
  if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return error(res,415,'UNSUPPORTED_CONTENT_TYPE');
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>2048
   ||Object.keys(input).sort().join(',')!=='password,username')return error(res,400,'INVALID_BODY');
  const username=normalizeAgentUsername(input.username);
  if(!username||typeof input.password!=='string'||input.password.length<15||input.password.length>128)
   return error(res,400,'INVALID_CREDENTIALS');
  const runtime=agentRuntime(env),origin=agentCheckoutOrigin(req,env);
  if(!runtime||env.LUO_AGENT_BILLING_ENABLED!=='true')return error(res,503,'CHECKOUT_NOT_AVAILABLE');
  if(!origin||req.headers?.origin&&req.headers.origin!==origin.slice(0,-1)
    ||req.headers?.['sec-fetch-site']==='cross-site')return error(res,403,'UNTRUSTED_ORIGIN');
  try{
   const secret=env.LUO_AGENT_SIGNUP_HASH_KEY;
   const ip=env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']:req.socket?.remoteAddress;
   if(typeof secret!=='string'||secret.length<32||typeof ip!=='string'||ip.length>64||ip.includes(',')||!isIP(ip))
    return error(res,503,'STATUS_RATE_LIMIT_UNAVAILABLE');
   const digest=value=>createHmac('sha256',secret).update(value).digest('hex');
   const svc=clientFactory(runtime.url,runtime.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const quota=await svc.rpc('luo_agent_reserve_login',{
    p_ip_digest:digest('status-network:'+ip),p_username_digest:digest('status-identity:'+username)
   });
   if(quota.error?.code==='P0001'){res.setHeader('Retry-After','86400');return error(res,429,'STATUS_RATE_LIMITED')}
   if(quota.error||quota.data!==true)throw Error('RATE_LIMIT_UNAVAILABLE');
   const auth=clientFactory(runtime.url,runtime.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const signed=await auth.auth.signInWithPassword({email:'agent+'+username+'@agents.luo.invalid',password:input.password});
   if(signed.error||!signed.data?.user?.id)return error(res,401,'INVALID_CREDENTIALS');
   const state=await svc.rpc('luo_agent_checkout_state',{p_auth_user:signed.data.user.id,p_username:username});
   if(state.error||!state.data?.state)throw Error('STATUS_UNAVAILABLE');
   const row=state.data;
   const payload={state:row.state,checkout_locked:!['not_started','ready'].includes(row.state),
    provider:row.provider??null,plan:row.plan??null,intent_id:row.intent_id??null,
    activation:row.state==='paid'?'payment_recorded':'awaiting_verified_payment'};
   if(row.state==='awaiting_payment'&&typeof row.checkout_reference==='string'){
    // Safe resume of the SAME session; never create another subscription here.
    try{
     if(row.provider==='stripe'&&checkoutReady(env,'stripe')){
      const session=await remote(fetcher,'https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(row.checkout_reference),env.LUO_STRIPE_SECRET_KEY);
      if(session.client_reference_id===row.intent_id&&session.status==='open'
       &&typeof session.url==='string'&&session.url.startsWith('https://checkout.stripe.com/'))
       payload.checkout_url=session.url;
     }else if(row.provider==='paypal'&&checkoutReady(env,'paypal')){
      const access=await paypalAccessToken(env,fetcher),merchant=paypalMerchantSettings(env);
      const sub=await remote(fetcher,merchant.api+'/v1/billing/subscriptions/'+encodeURIComponent(row.checkout_reference),access);
      const approve=sub.links?.find(x=>x.rel==='approve')?.href;
      if(sub.custom_id===row.intent_id&&typeof approve==='string'&&approve.startsWith(merchant.approval))
       payload.checkout_url=approve;
     }
    }catch{logger.error('LUO_AGENT_CHECKOUT_RESUME_UNAVAILABLE')}
   }
   return sendJson(res,200,payload);
  }catch{logger.error('LUO_AGENT_CHECKOUT_STATUS_FAILED');return error(res,503,'STATUS_UNAVAILABLE')}
 };
}
