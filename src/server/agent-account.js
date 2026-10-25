import {createHash,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {sendJson} from './agent-platform.js';

const STAGING_URL='https://itecovbwilcrvjqkdoyd.supabase.co';
const BRANCH='feature/reels-immersive-20261025';
export function paidAgentApiEnabled(env){
 return env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF===BRANCH
 &&env.LUO_AGENT_PAID_API_ENABLED==='true'
 &&env.LUO_AGENT_STAGING_URL===STAGING_URL
 &&typeof env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY==='string'
 &&env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY.length>=32;
}
export function newAgentCredential(random=randomBytes){
 const secret=random(32);
 if(!Buffer.isBuffer(secret)||secret.length!==32)throw Error('Secure randomness unavailable');
 const token='luoa_'+secret.toString('base64url');
 return {token,prefix:token.slice(0,13),hash:'\\x'+createHash('sha256').update(token).digest('hex')};
}
function tokenFromHeaders(req){
 const header=req.headers?.authorization;
 if(typeof header!=='string'||header.length>128)return null;
 const match=/^Bearer (luoa_[A-Za-z0-9_-]{43})$/.exec(header);
 return match?.[1]||null;
}
function rpcErrorIsQuota(error){return error?.code==='P0001'||error?.message?.includes('quota exceeded')}
export function createAgentAccountHandler({mode='profile',env=process.env,clientFactory=createClient,logger=console}={}){
 if(!['profile','usage'].includes(mode))throw Error('Unsupported agent account route');
 return async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED'}})}
  if(!paidAgentApiEnabled(env)){res.setHeader('Retry-After','86400');return sendJson(res,503,{error:{code:'AGENT_MEMBERSHIPS_NOT_ACTIVE'}})}
  const token=tokenFromHeaders(req);
  if(!token)return sendJson(res,401,{error:{code:'INVALID_AGENT_CREDENTIAL'}});
  try{
   const db=clientFactory(STAGING_URL,env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   const hash='\\x'+createHash('sha256').update(token).digest('hex');
   const scope=mode==='profile'?'profile:read':'usage:read';
   const result=await db.rpc('luo_agent_resolve_api_key',{p_hash:hash,p_scope:scope});
   if(result.error)throw Error('resolve_fail');
   const record=Array.isArray(result.data)?result.data[0]:null;
   if(!record?.agent_id)return sendJson(res,401,{error:{code:'INVALID_AGENT_CREDENTIAL'}});
   const debit=await db.rpc('luo_agent_consume_quota',{p_agent:record.agent_id,p_metric:'api'});
   if(debit.error){
    if(rpcErrorIsQuota(debit.error)){res.setHeader('Retry-After','60');return sendJson(res,429,{error:{code:'AGENT_RATE_LIMITED'}})}
    if(debit.error.code==='28000')return sendJson(res,403,{error:{code:'AGENT_MEMBERSHIP_INACTIVE'}});
    throw Error('quota_unavailable');
   }
   const detail=await db.rpc(mode==='profile'?'luo_agent_read_profile':'luo_agent_read_usage',{p_agent:record.agent_id});
   if(detail.error||!detail.data)throw Error('read_failed');
   return sendJson(res,200,{...detail.data,quota:debit.data});
  }catch{
   logger.error('LUO_AGENT_PRIVATE_API_FAILED');
   return sendJson(res,503,{error:{code:'AGENT_SERVICE_UNAVAILABLE'}});
  }
 };
}
