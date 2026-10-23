/**
 * Paymob TRANSACTION PROCESSED POST callback HMAC-SHA512 verification.
 *
 * Source: Paymob developer docs, transaction HMAC, EXACT 20-field order.
 * This is deliberately NOT the HMAC for a card-token callback or a browser
 * redirect. The webhook must use server-side POST only.
 *
 * The secret never belongs in frontend JavaScript or a mobile app.
 */
export const PAYMOB_TRANSACTION_HMAC_FIELDS=Object.freeze([
 'amount_cents','created_at','currency','error_occured','has_parent_transaction',
 'id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded',
 'is_standalone_payment','is_voided','order.id','owner','pending',
 'source_data.pan','source_data.sub_type','source_data.type','success',
]);
export function hmacTransactionString(payload){
 const obj=payload?.obj;
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Missing Paymob transaction object.');
 const get=(path)=>path.split('.').reduce((v,key)=>v&&typeof v==='object'&&Object.hasOwn(v,key)?v[key]:undefined,obj);
 return PAYMOB_TRANSACTION_HMAC_FIELDS.map(field=>{
  const value=get(field);
  if(value===undefined)throw Error('Missing Paymob callback field: '+field);
  if(value===null)return '';
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='number'&&Number.isFinite(value))return String(value);
  if(typeof value==='string')return value;
  throw Error('Invalid Paymob callback field.');
 }).join('');
}
function toBytes(value){
 if(!/^[a-fA-F0-9]{128}$/.test(value||''))return null;
 const result=new Uint8Array(64);
 for(let i=0;i<64;i++)result[i]=parseInt(value.slice(i*2,i*2+2),16);
 return result;
}
export async function verifyPaymobTransactionHmac({payload,signature,secret,cryptoImpl=crypto}={}){
 if(typeof secret!=='string'||secret.length<24)return false;
 const actual=toBytes(signature);
 if(!actual)return false;
 let data;
 try{data=hmacTransactionString(payload)}catch{return false}
 const key=await cryptoImpl.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);
 const expected=new Uint8Array(await cryptoImpl.subtle.sign('HMAC',key,new TextEncoder().encode(data)));
 let difference=0;
 // Equal-length byte-wise comparison; never use == on hex signatures.
 for(let i=0;i<64;i++)difference|=expected[i]^actual[i];
 return difference===0;
}
export function parsePaidPaymobTransaction(payload){
 const obj=payload?.obj;
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return null;
 if(payload.type!=='TRANSACTION')return null;
 const id=String(obj.id||''),orderId=String(obj.order?.id||'');
 const amount=Number(obj.amount_cents),currency=String(obj.currency||'');
 if(!/^[0-9]+$/.test(id)||!/^[0-9]+$/.test(orderId)||!Number.isSafeInteger(amount)||amount<=0)return null;
 if(!['EGP','USD','EUR'].includes(currency))return null;
 if(obj.success!==true||obj.pending!==false||obj.is_refunded===true||obj.is_voided===true)return null;
 if(obj.error_occured===true||obj.is_auth===true||obj.is_capture===true)return null;
 return {provider:'paymob',event_id:id,provider_order_id:orderId,amount_minor:amount,currency,status:'paid'};
}
