// Login is disabled until Stripe/PayPal membership activation has been reviewed.
// Issued token expires with the single current session and only carries read scopes.
import {createHmac,createHash,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';
import {createClient} from '@supabase/supabase-js';
import {normalizeAgentUsername,sendJson} from './agent-platform.js';
import {paidAgentApiEnabled,newAgentCredential} from './agent-account.js';
import {agentRuntime,isValidAgentOrigin} from './agent-environment.js';

const hash=(secret,text)=>createHmac('sha256',secret).update(text).digest('hex');
export function createAgentLoginHandler({env=process.env,clientFactory=createClient,logger=console}={}){
 return async (req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED'}})}
  if(!paidAgentApiEnabled(env)||typeof agentRuntime(env)?.publishableKey!=='string'||agentRuntime(env).publishableKey.length<25
    ||typeof env.LUO_AGENT_SIGNUP_HASH_KEY!=='string'||env.LUO_AGENT_SIGNUP_HASH_KEY.length<32){
   res.setHeader('Retry-After','86400');return sendJson(res,503,{error:{code:'AGENT_MEMBERSHIPS_NOT_ACTIVE'}});
  }
  if(!isValidAgentOrigin(req,env))return sendJson(res,403,{error:{code:'ORIGIN_DENIED'}});
  if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return sendJson(res,415,{error:{code:'UNSUPPORTED_CONTENT_TYPE'}});
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>2048
    ||Object.keys(input).some(k=>!['username','password'].includes(k)))return sendJson(res,400,{error:{code:'INVALID_BODY'}});
  const username=normalizeAgentUsername(input.username);
  if(!username||typeof input.password!=='string'||input.password.length<15||input.password.length>128)return sendJson(res,400,{error:{code:'INVALID_CREDENTIALS'}});
  const ip=env.VERCEL==='1'?req.headers?.['x-vercel-forwarded-for']:req.socket?.remoteAddress;
  if(typeof ip!=='string'||ip.length>64||ip.includes(',')||!isIP(ip))return sendJson(res,503,{error:{code:'RATE_LIMIT_UNAVAILABLE'}});
  const svc=clientFactory(agentRuntime(env).url,agentRuntime(env).serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
   const r=await svc.rpc('luo_agent_reserve_login',{p_ip_digest:hash(env.LUO_AGENT_SIGNUP_HASH_KEY,'login-network:'+ip),p_username_digest:hash(env.LUO_AGENT_SIGNUP_HASH_KEY,'login-name:'+username)});
   if(r.error?.code==='P0001'){res.setHeader('Retry-After','86400');return sendJson(res,429,{error:{code:'LOGIN_RATE_LIMITED'}})}
   if(r.error||r.data!==true)throw Error('login_quota_unavailable');
   const auth=clientFactory(agentRuntime(env).url,agentRuntime(env).publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const signed=await auth.auth.signInWithPassword({email:'agent+'+username+'@agents.luo.invalid',password:input.password});
   if(signed.error||!signed.data?.user?.id)return sendJson(res,401,{error:{code:'INVALID_CREDENTIALS'}});
   const agent=await svc.rpc('luo_agent_find_paid_identity',{p_auth_user:signed.data.user.id,p_username:username});
   if(agent.error)throw Error('membership_service_unavailable');
   if(!agent.data)return sendJson(res,402,{error:{code:'PAYMENT_REQUIRED',message:'No active paid agent membership.'}});
   const sessionHash='\\x'+createHash('sha256').update(randomBytes(32)).digest('hex');
   const lease=await svc.rpc('luo_agent_replace_session',{p_agent:agent.data,p_hash:sessionHash,p_ttl:3600});
   if(lease.error||!Number.isSafeInteger(Number(lease.data)))throw Error('session_unavailable');
   const key=newAgentCredential();
   const scopes=['profile:read','usage:read',...(env.LUO_AGENT_CHAT_ENABLED==='true'?['chat:read','chat:write']:[])];
   const issued=await svc.rpc('luo_agent_issue_api_key',{p_agent:agent.data,p_hash:key.hash,p_prefix:key.prefix,p_scopes:scopes});
   if(issued.error||!issued.data)throw Error('key_unavailable');
   res.setHeader('Pragma','no-cache');return sendJson(res,200,{agent_id:agent.data,identity_label:'AI Agent',api_token:key.token,token_type:'Bearer',expires_in_seconds_at_most:3600,scopes,session_replaced:true});
  }catch{
   logger.error('LUO_AGENT_LOGIN_FAILED');
   return sendJson(res,503,{error:{code:'AGENT_LOGIN_SERVICE_UNAVAILABLE'}});
  }
 };
}
