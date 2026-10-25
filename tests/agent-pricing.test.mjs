import test from 'node:test';import assert from 'node:assert/strict';
import {MEMBERSHIP_PRICES,quoteAgentPlan,campaignWindow,approvedStripePriceId,approvedStripeCouponId} from '../src/server/agent-pricing.js';
import {AGENT_PLANS,publicPlans} from '../src/server/agent-platform.js';
const start='2026-10-25T15:00:00Z';
test('approved Standard/Pro/Maximum prices and first-invoice discounts in USD',()=>{
 assert.deepEqual(Object.values(MEMBERSHIP_PRICES).map(x=>x.monthly_cents),[1200,2400,3000]);
 assert.deepEqual(Object.values(MEMBERSHIP_PRICES).map(x=>x.first_invoice_promo_cents),[300,600,900]);
 assert.deepEqual(Object.values(MEMBERSHIP_PRICES).map(x=>x.first_invoice_discount_cents),[900,1800,2100]);
});
test('promotion lasts 10 exact 24-hour days from explicit activation only',()=>{
 const window=campaignWindow(start);assert.equal(window.end,'2026-11-04T15:00:00.000Z');
 assert.equal(quoteAgentPlan('starter',{now:Date.parse(start)-1,promoStart:start}).offer_active,false);
 assert.equal(quoteAgentPlan('starter',{now:Date.parse(start),promoStart:start}).first_invoice_price,3);
 assert.equal(quoteAgentPlan('pro',{now:Date.parse(start)+864000000-1,promoStart:start}).first_invoice_price,6);
 assert.equal(quoteAgentPlan('max',{now:Date.parse(start)+864000000,promoStart:start}).first_invoice_price,30);
 assert.equal(quoteAgentPlan('max',{now:Date.parse(start),promoStart:start}).renewal_monthly_price,30);
 assert.equal(quoteAgentPlan('max',{now:Date.parse(start)}).offer_active,false);
 assert.equal(quoteAgentPlan('max',{now:Date.parse(start)}).offer_duration_days,null);
 assert.equal(quoteAgentPlan('max',{now:Date.parse(start)}).offer_applies_to,null);
 assert.equal(campaignWindow('not-a-date'),null);
});
test('Pro doubles Standard finite usage quotas and paid feature set expands',()=>{
 const a=AGENT_PLANS.starter.limits,b=AGENT_PLANS.pro.limits;
 for(const key of Object.keys(a))assert.equal(b[key],a[key]*2,key);
 assert.equal(AGENT_PLANS.pro.features.length,AGENT_PLANS.starter.features.length*2);
 assert.ok(AGENT_PLANS.max.features.length>AGENT_PLANS.pro.features.length);
 assert.deepEqual(publicPlans({now:Date.parse(start),promoStart:start}).map(p=>p.first_invoice_price),[3,6,9]);
});
test('merchant price/coupon IDs are strict server-only configurations',()=>{
 assert.equal(approvedStripePriceId({},'starter'),null);
 assert.equal(approvedStripePriceId({LUO_STRIPE_PRICE_STANDARD:'user-controlled'},'starter'),null);
 assert.equal(approvedStripePriceId({LUO_STRIPE_PRICE_STANDARD:'price_Abc123456789'},'starter'),'price_Abc123456789');
 assert.equal(approvedStripeCouponId({LUO_STRIPE_COUPON_PRO:'coupon_pro_2026'},'pro'),'coupon_pro_2026');
 assert.equal(approvedStripePriceId({LUO_STRIPE_PRICE_PRO:'price_Abc123456789'},'root'),null);
});
