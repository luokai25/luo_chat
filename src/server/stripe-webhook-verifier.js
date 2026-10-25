// Verification primitive only; this module does NOT activate subscriptions.
// Before any billing write, reconcile the subscription and invoice with Stripe
// and use an atomic, idempotent database transaction.
import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyStripeWebhook({rawBody,signature,secret,now=Math.floor(Date.now()/1000),tolerance=300}={}){
 if(!(Buffer.isBuffer(rawBody)||typeof rawBody==='string')||Buffer.byteLength(rawBody)>65536||!signature||typeof signature!=='string'||signature.length>2048||typeof secret!=='string'||secret.length<16)return null;
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(tolerance)||tolerance<0||tolerance>300)return null;
 const parts=signature.split(',').map(x=>x.trim()),timestampFields=parts.filter(x=>/^t=[0-9]{10,}$/.test(x));
 if(timestampFields.length!==1)return null;
 const timestamp=Number(timestampFields[0].slice(2));
 if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>tolerance)return null;
 const signatures=parts.filter(x=>/^v1=[0-9a-f]{64}$/i.test(x)).map(x=>Buffer.from(x.slice(3),'hex'));
 if(!signatures.length)return null;
 const mac=createHmac('sha256',secret).update(String(timestamp)+'.').update(rawBody).digest();
 if(!signatures.some(x=>x.length===mac.length&&timingSafeEqual(x,mac)))return null;
 try{
  const event=JSON.parse(rawBody.toString());
  if(!event||typeof event!=='object'||Array.isArray(event)||!/^evt_[a-zA-Z0-9]+$/.test(event.id||'')||typeof event.type!=='string'||!event.data||typeof event.data!=='object')return null;
  return event;
 }catch{return null}
}
export function paymentNeedsReconciliation(event){
 return ['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','invoice.paid','invoice.payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event?.type);
}
