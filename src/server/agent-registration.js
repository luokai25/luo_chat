// Staging-only autonomous pending AI-agent registration.
// Payment activation is a separate authenticated, provider-reconciled transaction.
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {normalizeAgentUsername,sendJson} from './agent-platform.js';
import {agentRuntime,isValidAgentOrigin} from './agent-environment.js';

const allowedKeys=new Set(['username','password','plan','verification_id']);
const verificationId=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function requireVerifiedAgentKey(env){return env.LUO_AGENT_REQUIRE_VERIFIED_KEY==='true';}
function dataFromRequest(req){
 const size=Number(req.headers?.['content-length']||'0');
 if(!Number.isFinite(size)||size<0||size>4096)throw Error('INVALID_BODY');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>4096||Object.keys(body).some(x=>!allowedKeys.has(x)))throw Error('INVALID_BODY');
 return body;
}
export function registrationIsEnabled(env){
 return !!agentRuntime(env)&&env.LUO_AGENT_PENDING_REGISTRATION_ENABLED==='true'
 &&typeof env.LUO_AGENT_SIGNUP_HASH_KEY==='string'&&env.LUO_AGENT_SIGNUP_HASH_KEY.length>=32;
}
function remoteIP(req,env){
 // Only an edge-controlled ingress header may be used; a global DB cap also
 // enforces a hard limit if a proxy allows address spoofing.
 const address=env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']:req.socket?.remoteAddress;
 if(typeof address!=='string'||address.length>64||address.includes(',')||!isIP(address))return null;
 return address;
}
const digest=(secret,input)=>createHmac('sha256',secret).update(input).digest('hex');
export function createAgentRegistrationHandler({env=process.env,clientFactory=createClient,logger=console}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});}
  if(!registrationIsEnabled(env)){
   res.setHeader('Retry-After','86400');
   return sendJson(res,503,{error:{code:'AGENT_MEMBERSHIPS_NOT_ACTIVE',message:'Pending agent registration is unavailable.'}});
  }
  if(req.headers?.['sec-fetch-site']==='cross-site'||!isValidAgentOrigin(req,env))return sendJson(res,403,{error:{code:'ORIGIN_DENIED'}});
  if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return sendJson(res,415,{error:{code:'UNSUPPORTED_CONTENT_TYPE'}});
  let input;try{input=dataFromRequest(req)}catch{return sendJson(res,400,{error:{code:'INVALID_BODY'}})}
  const username=normalizeAgentUsername(input.username);
  if(!username||typeof input.plan!=='string'||!['starter','pro','max'].includes(input.plan)
    ||typeof input.password!=='string'||input.password.length<15||input.password.length>128
    ||input.password.trim().length<15){
   return sendJson(res,400,{error:{code:'INVALID_REGISTRATION',message:'Use a valid username, plan and a password of at least 15 characters.'}});
  }
  const verifiedKeyRequired=requireVerifiedAgentKey(env);
  if(verifiedKeyRequired&&env.LUO_AGENT_VERIFICATION_ENABLED!=='true')return sendJson(res,503,{error:{code:'AGENT_KEY_PROOF_NOT_READY'}});
  if(verifiedKeyRequired&&!verificationId.test(input.verification_id||''))return sendJson(res,400,{error:{code:'VERIFIED_KEY_REQUIRED',message:'Finish Ed25519 proof and include verification_id.'}});
  if(!verifiedKeyRequired&&input.verification_id!==undefined)return sendJson(res,409,{error:{code:'VERIFIED_KEY_PROOF_NOT_ENABLED'}});
  const ip=remoteIP(req,env);
  if(!ip)return sendJson(res,503,{error:{code:'RATE_LIMIT_UNAVAILABLE'}});
  const db=clientFactory(agentRuntime(env).url,agentRuntime(env).serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const hashKey=env.LUO_AGENT_SIGNUP_HASH_KEY;
  let userId=null;
  try{
   const reservation=await db.rpc('luo_agent_reserve_pending_signup',{
    p_identity_digest:digest(hashKey,'name:'+username),
    p_network_digest:digest(hashKey,'network:'+ip)
   });
   if(reservation.error){
    if(reservation.error.code==='P0001'){res.setHeader('Retry-After','86400');return sendJson(res,429,{error:{code:'REGISTRATION_RATE_LIMITED'}})}
    throw Error('quota_backend');
   }
   if(reservation.data!==true)throw Error('quota_uncertain');
   // A synthetic reserved-domain address supports Supabase password hashing
   // without claiming a real owner email or sending verification mail.
   const created=await db.auth.admin.createUser({
    email:'agent+'+username+'@agents.luo.invalid',
    password:input.password,email_confirm:true,
    app_metadata:{luo_identity_type:'ai_agent'}
   });
   if(created.error||!created.data?.user?.id){
    if(created.error?.status===422||created.error?.status===409)return sendJson(res,409,{error:{code:'USERNAME_UNAVAILABLE'}});
    throw Error('auth_create');
   }
   userId=created.data.user.id;
   const row=await db.rpc(verifiedKeyRequired?'luo_agent_create_verified_pending_identity':'luo_agent_create_pending_identity',{
    p_auth_user:userId,p_username:username,p_requested_plan:input.plan,
    ...(verifiedKeyRequired?{p_verification:input.verification_id}:{})
   });
   if(row.error||typeof row.data!=='string')throw Error(row.error?.code==='23505'?'duplicate_username':'record_failed');
   return sendJson(res,201,{agent:{id:row.data,username,identity_label:'AI Agent',state:'pending',requested_plan:input.plan,key_proof_bound:verifiedKeyRequired},payment_activation:'unavailable',api_credential_issued:false});
  }catch(error){
   if(userId){
    try{const removed=await db.auth.admin.deleteUser(userId);if(removed.error)logger.error('LUO_AGENT_ORPHAN_ACCOUNT_CLEANUP_FAILED')}catch{logger.error('LUO_AGENT_ORPHAN_ACCOUNT_CLEANUP_FAILED')}
   }
   if(error.message==='duplicate_username')return sendJson(res,409,{error:{code:'USERNAME_OR_VERIFICATION_UNAVAILABLE'}});
   logger.error('LUO_AGENT_PENDING_REGISTRATION_FAILED');
   return sendJson(res,503,{error:{code:'REGISTRATION_UNAVAILABLE'}});
  }
 };
}
