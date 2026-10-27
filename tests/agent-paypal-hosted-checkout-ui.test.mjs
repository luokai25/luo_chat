import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('PayPal generated plans are used through locked server checkout, not unsupervised browser SDK buttons',async()=>{
 const html=await readFile('public/agent-checkout.html','utf8');
 const script=await readFile('public/luo-agent-checkout.js','utf8');
 assert.match(html,/PayPal secure checkout/);
 assert.match(html,/id="chargeDisclosure"/);
 assert.match(html,/id="check"/);
 assert.match(html,/aria-label="Enrollment progress"/);
 assert.doesNotMatch(html,/paypal\.Buttons|createSubscription|data-sdk-integration-source/);
 assert.match(script,/billing\/checkout/);
 assert.match(script,/billing\/status/);
 assert.match(script,/sessionStorage/);
 assert.match(script,/busy\|\|!available\|\|locked/);
});
test('incomplete merchant never allows live paid agent startup',async()=>{
 const src=await readFile('scripts/check-agent-live-paypal.mjs','utf8');
 assert.match(src,/LUO_AGENT_BILLING_ENABLED/);
 assert.match(src,/LUO_AGENT_PENDING_REGISTRATION_ENABLED/);
 assert.match(src,/LUO_AGENT_PAID_API_ENABLED/);
 assert.match(src,/PAYPAL_LIVE_PREFLIGHT_NOT_READY/);
 assert.match(src,/verifyLivePayPalPlans/);
 assert.match(src,/verifyLivePayPalWebhook/);
});
