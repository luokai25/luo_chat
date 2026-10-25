// Live PayPal merchant preflight. READ-ONLY: it cannot create plans, charges,
// subscriptions, webhooks or grant entitlements.
import {MEMBERSHIP_PRICES} from './agent-pricing.js';
const LIVE='https://api-m.paypal.com';
const TIERS=Object.freeze({starter:'STANDARD',pro:'PRO',max:'MAXIMUM'});
export const LIVE_PAYPAL_WEBHOOK_PATH='/api/v1/billing/paypal-webhook';
export function paypalLiveConfigPresent(env){
 return ['LUO_PAYPAL_LIVE_CLIENT_ID','LUO_PAYPAL_LIVE_CLIENT_SECRET'].every(k=>
  typeof env[k]==='string'&&env[k].length>=16)
  &&Object.values(TIERS).every(tier=>/^P-[A-Z0-9]{8,}$/.test(env['LUO_PAYPAL_PLAN_'+tier+'_REGULAR']||''));
}
export function exactRegularPayPalPlan(plan,tier,expected){
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||!expected)return false;
 const ids=plan.billing_cycles;
 if(plan.id!==expected.id||plan.status!=='ACTIVE'||!/^PROD-[A-Z0-9]{8,}$/.test(plan.product_id||'')
  ||!Array.isArray(ids)||ids.length!==1||plan.quantity_supported===true)return false;
 const cycle=ids[0],fixed=cycle?.pricing_scheme?.fixed_price;
 if(cycle?.tenure_type!=='REGULAR'||cycle?.total_cycles!==0||cycle?.sequence!==1
   ||cycle?.frequency?.interval_unit!=='MONTH'||cycle?.frequency?.interval_count!==1)return false;
 if(fixed?.currency_code!=='USD'||typeof fixed.value!=='string'
   ||!/^\d+\.\d{2}$/.test(fixed.value)||Number(fixed.value)*100!==MEMBERSHIP_PRICES[tier].monthly_cents)return false;
 if(plan.payment_preferences?.setup_fee&&Number(plan.payment_preferences.setup_fee.value)>0)return false;
 return true;
}
async function readJson(fetcher,url,options){
 const response=await fetcher(url,{...options,signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('PAYPAL_LIVE_PREFLIGHT_REMOTE_ERROR');
 const result=await response.json();
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('PAYPAL_LIVE_PREFLIGHT_RESPONSE_INVALID');
 return result;
}
export async function verifyLivePayPalPlans({env,fetcher=fetch}={}){
 if(!env||!paypalLiveConfigPresent(env))return {ok:false,reason:'CONFIGURATION_INCOMPLETE'};
 const auth=Buffer.from(env.LUO_PAYPAL_LIVE_CLIENT_ID+':'+env.LUO_PAYPAL_LIVE_CLIENT_SECRET).toString('base64');
 // No action here can charge a person. The only PayPal APIs used are OAuth
 // client credentials and GET /v1/billing/plans/{id}.
 let token;
 try{
  const oauth=await readJson(fetcher,LIVE+'/v1/oauth2/token',{
   method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},
   body:'grant_type=client_credentials'});
  if(typeof oauth.access_token!=='string'||oauth.access_token.length<20)throw Error('AUTH_MISSING');
  token=oauth.access_token;
  const plans=[];
  for(const [tier,label] of Object.entries(TIERS)){
   const id=env['LUO_PAYPAL_PLAN_'+label+'_REGULAR'];
   const raw=await readJson(fetcher,LIVE+'/v1/billing/plans/'+encodeURIComponent(id),{
    headers:{Authorization:'Bearer '+token,'Accept':'application/json'}});
   plans.push({tier,valid:exactRegularPayPalPlan(raw,tier,{id}),product_id:raw.product_id});
  }
  // A single product is expected, and all plans must be regular USD prices.
  const productIds=new Set(plans.map(p=>p.product_id));
  return {ok:plans.every(p=>p.valid)&&productIds.size===1,
   reason:plans.every(p=>p.valid)&&productIds.size===1?'MATCH':'PRICE_OR_PLAN_MISMATCH',
   plans:plans.map(p=>({tier:p.tier,valid:p.valid}))};
 }catch{
  return {ok:false,reason:'PAYPAL_UNREACHABLE_OR_UNAUTHORIZED'};
 }finally{token=undefined}
}
