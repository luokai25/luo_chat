import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {verifyStripeWebhook,paymentNeedsReconciliation} from '../src/server/stripe-webhook-verifier.js';
const secret='whsec_test_only_verifier_fixture_123456789';
const now=1780000000;
const event={id:'evt_test123',type:'invoice.paid',data:{object:{id:'in_test',status:'paid'}}};
const body=Buffer.from(JSON.stringify(event));
function sign(message=body,time=now,key=secret){return 't='+time+',v1='+createHmac('sha256',key).update(String(time)+'.').update(message).digest('hex')}
test('webhook accepts only raw signed timely provider data',()=>{
 const v=verifyStripeWebhook({rawBody:body,signature:sign(),secret,now});
 assert.deepEqual(v,event);
 assert.equal(paymentNeedsReconciliation(v),true);
 for(const attrs of [{signature:sign(body,now-301)},{rawBody:Buffer.from('{}')},{secret:'wrong_secret_but_very_long'},{signature:'t='+now+',v1='+'0'.repeat(64)},{signature:'garbage'},{signature:sign(body,now+301)}]){
  assert.equal(verifyStripeWebhook({rawBody:body,signature:sign(),secret,now,...attrs}),null);
 }
 assert.equal(verifyStripeWebhook({rawBody:body,signature:sign(),secret,now,tolerance:301}),null);
});
test('webhook parsing does not grant any subscription entitlements',()=>{
 const evil=Buffer.from(JSON.stringify({id:'evt_signed',type:'totally.unknown',data:{object:{paid:true}}}));
 const verified=verifyStripeWebhook({rawBody:evil,signature:sign(evil),secret,now});
 assert.equal(paymentNeedsReconciliation(verified),false);
 assert.equal(paymentNeedsReconciliation({type:'checkout.session.completed'}),true);
});
