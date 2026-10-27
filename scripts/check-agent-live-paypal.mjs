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
