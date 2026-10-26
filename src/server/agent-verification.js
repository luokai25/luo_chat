// Agent key verification is independent of billing, login, and human accounts.
// A key_verified result proves Ed25519 key possession, NOT a real-world identity.
import {createHash,createHmac,createPublicKey,randomBytes,verify} from 'node:crypto';
import {isIP} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {normalizeAgentUsername,sendJson} from './agent-platform.js';
const PROD='https://byjixqwpjvsgmqilmzbm.supabase.co';
const STAGE='https://itecovbwilcrvjqkdoyd.supabase.co';
const keyRx=/^[A-Za-z0-9_-]{43}$/;
const idRx=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function proofMessage(v){return 'LuoChat-Agent-Key-Proof-v1\n'+v.id+'\n'+v.nonce+'\n'+v.username}
export function verificationRuntime(e={}){
 if(e.LUO_AGENT_VERIFICATION_ENABLED!=='true')return null;
 if(e.VERCEL_ENV==='production'&&e.SUPABASE_URL===PROD&&typeof e.SUPABASE_SERVICE_ROLE_KEY==='string'&&e.SUPABASE_SERVICE_ROLE_KEY.length>=32)
  return {mode:'production',url:PROD,key:e.SUPABASE_SERVICE_ROLE_KEY};
 if(e.VERCEL_ENV==='preview'&&e.VERCEL_GIT_COMMIT_REF==='feature/reels-immersive-20261025'
 &&e.LUO_AGENT_STAGING_URL===STAGE&&typeof e.LUO_AGENT_STAGING_SERVICE_ROLE_KEY==='string'&&e.LUO_AGENT_STAGING_SERVICE_ROLE_KEY.length>=32)
  return {mode:'staging',url:STAGE,key:e.LUO_AGENT_STAGING_SERVICE_ROLE_KEY};
 return null;
}
const failed=(res,status,code)=>sendJson(res,status,{error:{code}});
function inputOf(req,keys){
 if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return null;
 const v=req.body;
 if(!v||typeof v!=='object'||Array.isArray(v)||JSON.stringify(v).length>2048||Object.keys(v).some(k=>!keys.includes(k)))return null;
 return v;
}
function publicKeyBytes(v){
 if(typeof v!=='string'||!keyRx.test(v))return null;
 const b=Buffer.from(v,'base64url');return b.length===32&&b.toString('base64url')===v?b:null;
}
function signatureBytes(v){
 if(typeof v!=='string'||v.length!==86||!/^[A-Za-z0-9_-]+$/.test(v))return null;
 const b=Buffer.from(v,'base64url');return b.length===64&&b.toString('base64url')===v?b:null;
}
const database=(r,f)=>f(r.url,r.key,{auth:{persistSession:false,autoRefreshToken:false}});
export function createAgentVerificationHandler({mode='info',env=process.env,clientFactory=createClient,random=randomBytes,logger=console}={}){
 if(!['info','start','finish','status'].includes(mode))throw Error('Invalid verification mode');
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const method=mode==='info'||mode==='status'?'GET':'POST';
  if(req.method!==method){res.setHeader('Allow',method);return failed(res,405,'METHOD_NOT_ALLOWED')}
  const runtime=verificationRuntime(env);
  if(mode==='info')return sendJson(res,200,{
   protocol:'LuoChat-Agent-Key-Proof-v1',verification_available:!!runtime,algorithm:'Ed25519',
   challenge_lifetime_seconds:600,verified_key_lifetime_days:30,
   proves:'control of Ed25519 private key only',membership_active:false,chat_access:false,payment_activation:'closed',
   routes:['/api/v1/agents/verification/start','/api/v1/agents/verification/finish','/api/v1/agents/verification/status']
  });
  if(!runtime){res.setHeader('Retry-After','86400');return failed(res,503,'VERIFICATION_UNAVAILABLE')}
  if(req.headers?.['sec-fetch-site']==='cross-site')return failed(res,403,'ORIGIN_DENIED');
  if(runtime.mode==='production'&&req.headers?.origin&&req.headers.origin!=='https://luo-chat-luokai25.vercel.app')
   return failed(res,403,'ORIGIN_DENIED');
  if(mode==='status'){
   if(typeof req.query?.id!=='string'||!idRx.test(req.query.id))return failed(res,400,'INVALID_VERIFICATION_ID');
   try{
    const r=await database(runtime,clientFactory).rpc('luo_agent_verify_status',{p_id:req.query.id});
    if(r.error)throw r.error;
    return r.data?sendJson(res,200,{verification:r.data}):failed(res,404,'VERIFICATION_NOT_FOUND');
   }catch{logger.error('LUO_VERIFY_STATUS_UNAVAILABLE');return failed(res,503,'VERIFICATION_SERVICE_UNAVAILABLE')}
  }
  const v=inputOf(req,mode==='start'?['username','public_key']:['id','signature']);
  if(!v)return failed(res,400,'INVALID_BODY');
  if(mode==='start'){
   const username=normalizeAgentUsername(v.username),pub=publicKeyBytes(v.public_key);
   if(!username||!pub)return failed(res,400,'INVALID_KEY_OR_USERNAME');
   const ip=env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']:req.socket?.remoteAddress;
   if(typeof ip!=='string'||ip.length>64||ip.includes(',')||!isIP(ip))return failed(res,503,'RATE_LIMIT_UNAVAILABLE');
   const nonce=random(32);
   if(!Buffer.isBuffer(nonce)||nonce.length!==32)return failed(res,503,'SECURE_RANDOM_UNAVAILABLE');
   const n=nonce.toString('base64url');
   try{
    const result=await database(runtime,clientFactory).rpc('luo_agent_verify_start',{
     p_username:username,p_public_key:v.public_key,
     p_fingerprint:createHash('sha256').update(pub).digest('hex'),p_nonce:n,
     p_network_digest:createHmac('sha256',runtime.key).update('agent-verify-ip:v1:'+ip).digest('hex')
    });
    if(result.error){
     if(result.error.code==='P0001'){res.setHeader('Retry-After','86400');return failed(res,429,'VERIFICATION_RATE_LIMITED')}
     throw result.error;
    }
    if(!idRx.test(result.data?.id))throw Error('Missing challenge ID');
    return sendJson(res,201,{
     verification_id:result.data.id,challenge:proofMessage({id:result.data.id,nonce:n,username}),
     expires_at:result.data.expires_at,algorithm:'Ed25519',
     membership_active:false,chat_access:false
    });
   }catch{logger.error('LUO_VERIFY_START_UNAVAILABLE');return failed(res,503,'VERIFICATION_SERVICE_UNAVAILABLE')}
  }
  const signature=signatureBytes(v.signature);
  if(!idRx.test(v.id)||!signature)return failed(res,400,'INVALID_SIGNATURE_OR_ID');
  try{
   const db=database(runtime,clientFactory);
   const lookup=await db.rpc('luo_agent_verify_attempt',{p_id:v.id});
   if(lookup.error)throw lookup.error;
   const row=lookup.data;
   if(!row||row.state!=='pending'||Date.parse(row.expires_at)<=Date.now())
    return failed(res,409,'CHALLENGE_INVALID_OR_EXPIRED');
   if(!publicKeyBytes(row.public_key))return failed(res,503,'VERIFICATION_SERVICE_UNAVAILABLE');
   const key=createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:row.public_key},format:'jwk'});
   if(!verify(null,Buffer.from(proofMessage({id:row.id,nonce:row.challenge_nonce,username:row.username})),key,signature))
    return failed(res,401,'SIGNATURE_VERIFICATION_FAILED');
   const result=await db.rpc('luo_agent_verify_complete',{
    p_id:row.id,p_signature_digest:createHash('sha256').update(signature).digest('hex')
   });
   if(result.error)throw result.error;
   if(!result.data)return failed(res,409,'CHALLENGE_INVALID_OR_EXPIRED');
   return sendJson(res,200,{
    verification:{...result.data,proves:'Ed25519 key possession',
     membership_active:false,chat_access:false,payment_activation:'closed'}
   });
  }catch{logger.error('LUO_VERIFY_FINISH_UNAVAILABLE');return failed(res,503,'VERIFICATION_SERVICE_UNAVAILABLE')}
 };
}
