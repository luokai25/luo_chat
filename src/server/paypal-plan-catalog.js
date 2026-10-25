// Declarative recurring billing plans for the operator's PayPal merchant account.
// This does not request money, open checkout, or activate an agent identity.
import {MEMBERSHIP_PRICES} from './agent-pricing.js';
const suffix={starter:'STANDARD',pro:'PRO',max:'MAXIMUM'};
const money=cent=>(cent/100).toFixed(2);
const cycle=(price,sequence,kind='REGULAR',total_cycles=0)=>({
 frequency:{interval_unit:'MONTH',interval_count:1},
 tenure_type:kind,sequence,total_cycles,
 pricing_scheme:{fixed_price:{value:money(price),currency_code:'USD'}}
});
export function buildPayPalPlanDefinition({plan,productId,promo=false}={}){
 const p=MEMBERSHIP_PRICES[plan];
 if(!p||typeof productId!=='string'||!/^PROD-[A-Z0-9]{8,}$/.test(productId))throw Error('PayPal catalog product and approved plan required');
 if(typeof promo!=='boolean')throw Error('Invalid promotion flag');
 return{
  product_id:productId,
  name:'Luo Chat AI '+p.name+(promo?' Launch Offer':''),
  description:promo
   ?p.name+': first month $'+money(p.first_invoice_promo_cents)+' USD, then $'+money(p.monthly_cents)+' USD per month until canceled.'
   :p.name+': $'+money(p.monthly_cents)+' USD monthly until canceled.',
  status:'CREATED',
  billing_cycles:promo
   ?[cycle(p.first_invoice_promo_cents,1,'TRIAL',1),cycle(p.monthly_cents,2)]
   :[cycle(p.monthly_cents,1)],
  payment_preferences:{auto_bill_outstanding:false,payment_failure_threshold:1},
  quantity_supported:false
 };
}
export function paypalRequiredPlanSettings(){
 return Object.values(suffix).flatMap(tier=>[
  'LUO_PAYPAL_PLAN_'+tier+'_REGULAR','LUO_PAYPAL_PLAN_'+tier+'_PROMO'
 ]);
}
export function paypalMerchantConfigured(env={}){
 return env.LUO_PAYPAL_ENV==='sandbox'
  &&typeof env.LUO_PAYPAL_CLIENT_ID==='string'&&env.LUO_PAYPAL_CLIENT_ID.length>12
  &&typeof env.LUO_PAYPAL_CLIENT_SECRET==='string'&&env.LUO_PAYPAL_CLIENT_SECRET.length>20
  &&typeof env.LUO_PAYPAL_WEBHOOK_ID==='string'&&env.LUO_PAYPAL_WEBHOOK_ID.length>=8
  &&paypalRequiredPlanSettings().every(key=>/^P-[A-Z0-9-]{8,}$/.test(env[key]||''));
}
