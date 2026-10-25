import test from 'node:test';import assert from 'node:assert/strict';
import {buildPayPalPlanDefinition,paypalRequiredPlanSettings,paypalMerchantConfigured} from '../src/server/paypal-plan-catalog.js';
const productId='PROD-ABCDEF1234567890';
test('PayPal launch plans settle directly to operator with exactly one discounted first month',()=>{
 for(const [plan,promo,regular] of [['starter','3.00','12.00'],['pro','6.00','24.00'],['max','9.00','30.00']]){
  const p=buildPayPalPlanDefinition({plan,productId,promo:true});
  assert.equal(p.status,'CREATED');
  assert.equal(p.billing_cycles.length,2);
  const [first,following]=p.billing_cycles;
  assert.equal(first.tenure_type,'TRIAL');assert.equal(first.total_cycles,1);
  assert.equal(first.frequency.interval_unit,'MONTH');
  assert.equal(first.pricing_scheme.fixed_price.value,promo);
  assert.equal(following.tenure_type,'REGULAR');assert.equal(following.total_cycles,0);
  assert.equal(following.pricing_scheme.fixed_price.value,regular);
  assert.match(p.description,/until canceled/);
 }
});
test('Regular PayPal plan has a single indefinitely recurring monthly cycle',()=>{
 const p=buildPayPalPlanDefinition({plan:'pro',productId});
 assert.equal(p.billing_cycles.length,1);
 assert.equal(p.billing_cycles[0].tenure_type,'REGULAR');
 assert.equal(p.billing_cycles[0].pricing_scheme.fixed_price.value,'24.00');
 assert.equal(p.payment_preferences.auto_bill_outstanding,false);
});
test('No merchant setup or invented product IDs can silently activate checkout',()=>{
 assert.equal(paypalMerchantConfigured({}),false);
 assert.throws(()=>buildPayPalPlanDefinition({plan:'pro',productId:'a-bad-product'}),/product/);
 assert.throws(()=>buildPayPalPlanDefinition({plan:'madeup',productId}),/product/);
 assert.equal(paypalRequiredPlanSettings().length,6);
 const env={LUO_PAYPAL_ENV:'sandbox',LUO_PAYPAL_CLIENT_ID:'01234567890123456789',
 LUO_PAYPAL_CLIENT_SECRET:'a'.repeat(32),LUO_PAYPAL_WEBHOOK_ID:'WEBHOOKTESTID'};
 for(const key of paypalRequiredPlanSettings())env[key]='P-ABCDEFGHIJKLM';
 assert.equal(paypalMerchantConfigured(env),true);
 delete env.LUO_PAYPAL_PLAN_PRO_PROMO;
 assert.equal(paypalMerchantConfigured(env),false);
});
