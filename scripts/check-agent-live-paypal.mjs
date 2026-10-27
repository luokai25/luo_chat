// Read-only merchant diagnostics. Never logs credentials, tokens, or customer data.
const env=process.env; if(env.VERCEL_ENV!=="production")throw Error("Production inspection only"); const auth=Buffer.from(env.LUO_PAYPAL_LIVE_CLIENT_ID+":"+env.LUO_PAYPAL_LIVE_CLIENT_SECRET).toString("base64"); const oauth=await fetch("https://api-m.paypal.com/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+auth,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials",signal:AbortSignal.timeout(12000)});if(!oauth.ok)throw Error("PAYPAL_READ_AUTH_FAILED"); const token=(await oauth.json()).access_token; for(const tier of ["STANDARD","PRO","MAXIMUM"]){const id=env["LUO_PAYPAL_PLAN_"+tier+"_REGULAR"]; const r=await fetch("https://api-m.paypal.com/v1/billing/plans/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error("PAYPAL_PLAN_READ_FAILED"); const p=await r.json();console.log("LUO_PAYPAL_PLAN_DIAGNOSTIC",JSON.stringify({tier,status:p.status,id_matches:p.id===id,product_format:/^PROD-[A-Z0-9]{8,}$/.test(p.product_id||""),quantity_supported:p.quantity_supported,billing_cycles:p.billing_cycles?.map(c=>({tenure_type:c.tenure_type,total_cycles:c.total_cycles,sequence:c.sequence,frequency:c.frequency,fixed_price:c.pricing_scheme?.fixed_price})),setup_fee:p.payment_preferences?.setup_fee}));} console.log("LUO_PAYPAL_WEBHOOK_DIAGNOSTIC",JSON.stringify(await verifyLivePayPalWebhook({env})));
// Build-time verification only: OAuth plus GET plan and webhook checks.
import {verifyLivePayPalPlans,verifyLivePayPalWebhook} from '../src/server/paypal-live-preflight.js';
if(process.env.VERCEL_ENV!=='production')throw Error('PREFLIGHT_REQUIRES_PRODUCTION_ENV');
const [plans,hook]=await Promise.all([
 verifyLivePayPalPlans({env:process.env}),
 verifyLivePayPalWebhook({env:process.env})
]);
console.log('LUO_AGENT_LIVE_PREFLIGHT',JSON.stringify({
 plans_ok:plans.ok,plans_reason:plans.reason,
 plans:plans.plans?.map(p=>({tier:p.tier,valid:p.valid})),
 webhook_ok:hook.ok,webhook_reason:hook.reason,
 payment_created:false
}));
// Disabled-by-default release canaries may ship docs and safe public endpoints.
// Any enabled registration, billing or API entitlement must fail the build.
const activating=[
 'LUO_AGENT_BILLING_ENABLED','LUO_AGENT_LIVE_CHECKOUT_ENABLED',
 'LUO_AGENT_PENDING_REGISTRATION_ENABLED','LUO_AGENT_PAID_API_ENABLED',
 'LUO_AGENT_POSTS_ENABLED','LUO_AGENT_CHAT_ENABLED'
].some(k=>process.env[k]==='true');
if(!plans.ok||!hook.ok){
 if(activating)throw Error('PAYPAL_LIVE_PREFLIGHT_NOT_READY');
 console.warn('Agent public documentation only: live payments remain DISABLED, merchant verification pending.');
}
