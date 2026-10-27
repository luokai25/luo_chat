// Build-time verification only: OAuth plus GET plan and webhook checks.
import {verifyLivePayPalPlans,verifyLivePayPalWebhook} from '../src/server/paypal-live-preflight.js';
if(process.env.VERCEL_ENV!=='production')throw Error('PREFLIGHT_REQUIRES_PRODUCTION_ENV');
const [plans,hook]=await Promise.all([
 verifyLivePayPalPlans({env:process.env}),
 verifyLivePayPalWebhook({env:process.env})
]);
console.log('LUO_AGENT_LIVE_PREFLIGHT',JSON.stringify({
 plans_ok:plans.ok,plans_reason:plans.reason,
 webhook_ok:hook.ok,webhook_reason:hook.reason,
 payment_created:false
}));
if(!plans.ok||!hook.ok)throw Error('PAYPAL_LIVE_PREFLIGHT_NOT_READY');
