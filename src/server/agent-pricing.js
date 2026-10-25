// Fixed, operator-approved USD monthly prices. A ten-day campaign offers
// a FIRST-invoice discount; subsequent subscription invoices use the full price.
// The campaign starts only once LUO_AGENT_PROMO_START_AT is set by the operator.
export const PROMO_DURATION_MS=10*24*60*60*1000;
export const MEMBERSHIP_PRICES=Object.freeze({
  starter:Object.freeze({name:'Standard',monthly_cents:1200,first_invoice_promo_cents:300,first_invoice_discount_cents:900,currency:'usd'}),
  pro:Object.freeze({name:'Pro',monthly_cents:2400,first_invoice_promo_cents:600,first_invoice_discount_cents:1800,currency:'usd'}),
  max:Object.freeze({name:'Maximum',monthly_cents:3000,first_invoice_promo_cents:900,first_invoice_discount_cents:2100,currency:'usd'})
});
export function campaignWindow(start){
 if(typeof start!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(start))return null;
 const begin=Date.parse(start);
 if(!Number.isFinite(begin))return null;
 return {start:new Date(begin).toISOString(),end:new Date(begin+PROMO_DURATION_MS).toISOString()};
}
export function quoteAgentPlan(plan,{now=Date.now(),promoStart}={}){
 const spec=MEMBERSHIP_PRICES[plan];if(!spec)return null;
 const window=campaignWindow(promoStart);
 const promo=!!window&&Number.isFinite(now)&&now>=Date.parse(window.start)&&now<Date.parse(window.end);
 return {id:plan,name:spec.name,currency:'USD',monthly_price:spec.monthly_cents/100,
 first_invoice_price:(promo?spec.first_invoice_promo_cents:spec.monthly_cents)/100,
 renewal_monthly_price:spec.monthly_cents/100,offer_active:promo,
 offer_window:window,offer_duration_days:window?10:null,
 offer_applies_to:promo?'first monthly invoice only':null,renewal_notice:promo?'Subsequent monthly invoices renew at the regular monthly price unless canceled.':'Renews at the regular monthly price until canceled.'};
}
export function allAgentQuotes(options={}){return Object.keys(MEMBERSHIP_PRICES).map(k=>quoteAgentPlan(k,options));}
export function approvedStripePriceId(env,plan){
 const suffix=({starter:'STANDARD',pro:'PRO',max:'MAXIMUM'})[plan];
 if(!suffix)return null;const p=env['LUO_STRIPE_PRICE_'+suffix];
 return typeof p==='string'&&/^price_[A-Za-z0-9]{8,}$/.test(p)?p:null;
}
export function approvedStripeCouponId(env,plan){
 const suffix=({starter:'STANDARD',pro:'PRO',max:'MAXIMUM'})[plan];
 if(!suffix)return null;const p=env['LUO_STRIPE_COUPON_'+suffix];
 return typeof p==='string'&&/^[A-Za-z0-9_-]{6,100}$/.test(p)?p:null;
}
