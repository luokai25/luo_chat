import {timedFetch,readRequestJSON} from '../_shared/http.ts';
import {verifyPaymobTransactionHmac,parsePaidPaymobTransaction} from '../_shared/paymob-transaction.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';

/**
 * Incoming POST only. The payment provider sends ?hmac=<sha512 hex>.
 * This must be deployed with verify_jwt=false (webhooks have no user JWT),
 * but is fail-closed without the HMAC secret and strict integration IDs.
 */
Deno.serve(async req=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(status:number,message:string)=>new Response(JSON.stringify({ok:status===200,message}),{status,headers});
 if(req.method!=='POST')return reply(405,'Method not allowed.');
 const secret=Deno.env.get('PAYMOB_HMAC_SECRET')||'';
 const integration=Deno.env.get('PAYMOB_INTEGRATION_ID')||'';
 const owner=Deno.env.get('PAYMOB_OWNER_ID')||'';
 const url=Deno.env.get('SUPABASE_URL')||'';
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(secret.length<24||!integration||!owner||!url||!key)
  return reply(503,'Payment verification is not configured.');
 let payload:Record<string,unknown>;
 try{payload=await readRequestJSON(req,65536) as Record<string,unknown>}
 catch{return reply(400,'Invalid callback body.')}
 const signature=new URL(req.url).searchParams.get('hmac')||'';
 const trusted=await verifyPaymobTransactionHmac({payload,signature,secret});
 if(!trusted)return reply(401,'Invalid callback signature.');
 const transaction=payload.obj as Record<string,unknown>;
 if(String(transaction.integration_id||'')!==integration||String(transaction.owner||'')!==owner)
  return reply(403,'Callback merchant does not match.');
 // Never mistake sandbox payments for live money, or accept a client redirect.
 if(transaction.is_live!==true)return reply(403,'Live settlement required.');
 const parsed=parsePaidPaymobTransaction(payload);
 if(!parsed)return reply(200,'Non-paid callback ignored.');
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
 try{
  const settled=await admin.rpc('settle_luo_bot_payment',{
   p_provider:'paymob',
   p_event_id:parsed.event_id,
   p_provider_order_id:parsed.provider_order_id,
   p_amount_minor:parsed.amount_minor,
   p_currency:parsed.currency,
   p_outcome:parsed.status
  });
  if(settled.error)return reply(503,'Payment ledger temporarily unavailable.');
  // A duplicate callback, nonexistent order, mismatched amount, or settled
  // order must never extend subscription time.
  if(settled.data!==true)return reply(409,'No matching pending order.');
  return reply(200,'Payment confirmed by verified callback.');
 }catch{
  return reply(503,'Payment ledger temporarily unavailable.');
 }
});
