import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {webcrypto} from 'node:crypto';
const raw=await readFile('supabase/functions/_shared/paymob-transaction.ts','utf8');
const bundle=(await transform(raw,{loader:'ts',target:'es2022',format:'cjs'})).code;
const box={exports:{},module:{exports:{}},crypto:webcrypto,TextEncoder,Uint8Array,Object,Array,Date};
vm.runInNewContext(bundle,box);
const paymob=box.module.exports;
const secret='a-server-only-example-paymob-hmac-secret-123456789';
const transaction={
 amount_cents:25000,created_at:'2026-10-23T13:00:00Z',currency:'EGP',
 error_occured:false,has_parent_transaction:false,
 id:123456789,integration_id:4567,is_3d_secure:true,is_auth:false,
 is_capture:false,is_refunded:false,is_standalone_payment:true,
 is_voided:false,order:{id:7654321},owner:9001,pending:false,
 source_data:{pan:'xxxx1234',sub_type:'MasterCard',type:'card'},
 success:true,is_live:true
};
const payload={type:'TRANSACTION',obj:transaction};
async function signature(p,secretValue=secret){
 const data=paymob.hmacTransactionString(p);
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secretValue),{name:'HMAC',hash:'SHA-512'},false,['sign']);
 return Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))).toString('hex');
}
test('HMAC canonical payload uses Paymob official 20-field order',()=>{
 assert.equal(paymob.PAYMOB_TRANSACTION_HMAC_FIELDS.length,20);
 assert.equal(paymob.PAYMOB_TRANSACTION_HMAC_FIELDS[13],'order.id');
 assert.equal(paymob.PAYMOB_TRANSACTION_HMAC_FIELDS[19],'success');
 const value=paymob.hmacTransactionString(payload);
 assert.ok(value.startsWith('250002026-10-23T13:00:00ZEGPfalsefalse1234567894567'));
 assert.ok(value.endsWith('xxxx1234MasterCardcardtrue'));
});
test('valid verified Paymob callback is accepted only with a matching SHA-512 HMAC',async()=>{
 const hmac=await signature(payload);
 assert.equal(hmac.length,128);
 assert.equal(await paymob.verifyPaymobTransactionHmac({payload,signature:hmac,secret,cryptoImpl:webcrypto}),true);
 assert.equal(await paymob.verifyPaymobTransactionHmac({payload,signature:hmac.slice(0,-1)+'0',secret,cryptoImpl:webcrypto}),false);
 assert.equal(await paymob.verifyPaymobTransactionHmac({payload,signature:hmac,secret:'a different merchant secret with enough length',cryptoImpl:webcrypto}),false);
 assert.equal(await paymob.verifyPaymobTransactionHmac({payload,signature:hmac,secret:'',cryptoImpl:webcrypto}),false);
});
test('mutating any of the signed merchant, order, amount, status or recipient fields fails HMAC',async()=>{
 const hmac=await signature(payload);
 for(const change of [
  {amount_cents:25001},{currency:'USD'},{id:123456788},
  {integration_id:4568},{owner:9002},{pending:true},{success:false},
  {is_refunded:true},{is_voided:true},{order:{id:9999999}},
  {source_data:{pan:'xxxx9999',sub_type:'MasterCard',type:'card'}}
 ]){
  const forged={type:'TRANSACTION',obj:{...transaction,...change}};
  assert.equal(await paymob.verifyPaymobTransactionHmac({payload:forged,signature:hmac,secret,cryptoImpl:webcrypto}),false,JSON.stringify(change));
 }
});
test('only settled, non-refunded, non-authorization transaction grants bot entitlement',()=>{
 const p=paymob.parsePaidPaymobTransaction(payload);
 assert.equal(p.status,'paid');
 assert.equal(p.event_id,'123456789');
 assert.equal(p.provider_order_id,'7654321');
 assert.equal(p.amount_minor,25000);
 assert.equal(p.currency,'EGP');
 for(const change of [{pending:true},{success:false},{is_auth:true},{is_capture:true},{amount_cents:0},{currency:'BTC'},{error_occured:true}]){
  assert.equal(paymob.parsePaidPaymobTransaction({type:'TRANSACTION',obj:{...transaction,...change}}),null,JSON.stringify(change));
 }
 assert.equal(paymob.parsePaidPaymobTransaction({...payload,type:'TOKEN'}),null);
});
test('signed refund and void events revoke entitlement and do not repeat an earlier payment event identifier',()=>{
 const refund=paymob.parsePaidPaymobTransaction({type:'TRANSACTION',obj:{...transaction,is_refunded:true}});
 assert.equal(refund.status,'refunded');
 assert.equal(refund.event_id,'123456789:refunded');
 const voided=paymob.parsePaidPaymobTransaction({type:'TRANSACTION',obj:{...transaction,is_voided:true}});
 assert.equal(voided.status,'disputed');
 assert.equal(voided.event_id,'123456789:voided');
});
test('webhook rejects GET, missing payment configuration, forged HMAC and wrong merchant before any ledger write',async()=>{
 const shared=(await transform((await readFile('supabase/functions/_shared/http.ts','utf8')).replaceAll('export ',''),{loader:'ts',target:'es2022'})).code;
 const webhook=(await transform((await readFile('supabase/functions/luo-bot-payment-webhook/index.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',target:'es2022'})).code;
 let handler,calls=[];
 let config=true;
 const Deno={env:{get:name=>!config?undefined:({
  PAYMOB_HMAC_SECRET:secret,PAYMOB_INTEGRATION_ID:'4567',PAYMOB_OWNER_ID:'9001',
  SUPABASE_URL:'https://backend.example',SUPABASE_SERVICE_ROLE_KEY:'server-key'
 }[name])},serve:f=>handler=f};
 vm.runInNewContext(shared+'\n'+raw.replaceAll('export ','')+'\n'+webhook,{
  Deno,createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:true,error:null}}}),
  Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,AbortSignal,
  crypto:webcrypto,setTimeout,clearTimeout,fetch,Date
 });
 const build=async(p=payload,hmac=null)=>new Request('https://webhook.example/paymob?hmac='+(hmac||await signature(p)),{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)
 });
 let response=await handler(new Request('https://webhook.example/paymob',{method:'GET'}));
 assert.equal(response.status,405);
 config=false;response=await handler(await build());assert.equal(response.status,503);
 config=true;response=await handler(await build(payload,'0'.repeat(128)));assert.equal(response.status,401);
 response=await handler(await build({type:'TRANSACTION',obj:{...transaction,integration_id:1234}}));
 assert.equal(response.status,403);
 assert.equal(calls.length,0);
 response=await handler(await build());assert.equal(response.status,200);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'settle_luo_bot_payment');
 assert.equal(calls[0].args.p_amount_minor,25000);
 assert.equal(calls[0].args.p_outcome,'paid');
 const refund={type:'TRANSACTION',obj:{...transaction,is_refunded:true}};
 response=await handler(await build(refund));assert.equal(response.status,200);
 assert.equal(calls[1].args.p_outcome,'refunded');
});
