// Staging-only agent-to-agent transport. Never enters human inboxes without
// separately reviewed age and guardian consent safeguards.
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {paidAgentApiEnabled} from './agent-account.js';
import {normalizeAgentUsername,sendJson} from './agent-platform.js';
import {agentRuntime} from './agent-environment.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function agentMessagingEnabled(env){return paidAgentApiEnabled(env)&&env.LUO_AGENT_CHAT_ENABLED==='true'}
export function createAgentMessagingHandler({mode='messages',env=process.env,clientFactory=createClient,logger=console}={}){
 if(!['messages','peers'].includes(mode))throw Error('Unknown messaging mode');
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)||(mode==='peers'&&req.method!=='POST')){
   res.setHeader('Allow',mode==='peers'?'POST':'GET, POST');
   return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});
  }
  if(!agentMessagingEnabled(env)){res.setHeader('Retry-After','86400');return sendJson(res,503,{error:{code:'AGENT_CHAT_NOT_ACTIVE'}})}
  const auth=req.headers?.authorization;
  if(typeof auth!=='string'||!/^Bearer luoa_[A-Za-z0-9_-]{43}$/.test(auth))return sendJson(res,401,{error:{code:'INVALID_AGENT_CREDENTIAL'}});
  if(req.headers?.['sec-fetch-site']==='cross-site')return sendJson(res,403,{error:{code:'ORIGIN_DENIED'}});
  if(req.method==='POST'&&req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return sendJson(res,415,{error:{code:'UNSUPPORTED_CONTENT_TYPE'}});
  const body=req.method==='POST'?req.body:{peer:req.query?.peer};
  if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>6000)return sendJson(res,400,{error:{code:'INVALID_BODY'}});
  if(req.method==='POST'){
   const fields=mode==='peers'?['action','username','peer']:['to','id','text'];
   if(Object.keys(body).some(key=>!fields.includes(key)))return sendJson(res,400,{error:{code:'INVALID_BODY'}});
  }
  // Reject bad messages before touching the database or consuming another user's quota.
  if(mode==='messages'&&req.method==='POST'
    &&(!uuid.test(body.to||'')||!uuid.test(body.id||'')||typeof body.text!=='string'
      ||body.text.length>4000||!body.text.trim()))return sendJson(res,400,{error:{code:'INVALID_MESSAGE'}});
  if(mode==='peers'&&body.action==='find'&&!normalizeAgentUsername(body.username))return sendJson(res,400,{error:{code:'INVALID_USERNAME'}});
  if(mode==='peers'&&body.action==='approve'&&!uuid.test(body.peer||''))return sendJson(res,400,{error:{code:'INVALID_PEER'}});
  if(mode==='peers'&&!['find','approve'].includes(body.action))return sendJson(res,400,{error:{code:'INVALID_ACTION'}});
  const scope=req.method==='GET'?'chat:read':mode==='peers'&&body.action==='find'?'chat:read':'chat:write';
  try{
   const db=clientFactory(agentRuntime(env).url,agentRuntime(env).serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const token=auth.slice('Bearer '.length);
   const resolved=await db.rpc('luo_agent_resolve_api_key',{p_hash:'\\x'+createHash('sha256').update(token).digest('hex'),p_scope:scope});
   const agent=resolved.data?.[0]?.agent_id;
   if(resolved.error||!agent)return sendJson(res,401,{error:{code:'INVALID_AGENT_CREDENTIAL'}});
   const charged=await db.rpc('luo_agent_consume_quota',{p_agent:agent,p_metric:'api'});
   if(charged.error){
    if(charged.error.code==='P0001'){res.setHeader('Retry-After','60');return sendJson(res,429,{error:{code:'AGENT_RATE_LIMITED'}})}
    return sendJson(res,403,{error:{code:'AGENT_MEMBERSHIP_INACTIVE'}});
   }
   let result;
   if(mode==='peers'){
    if(body.action==='find'){
     const username=normalizeAgentUsername(body.username);
     if(!username)return sendJson(res,400,{error:{code:'INVALID_USERNAME'}});
     result=await db.rpc('luo_agent_find_peer',{p_actor:agent,p_username:username});
    }else if(body.action==='approve'){
     if(!uuid.test(body.peer||''))return sendJson(res,400,{error:{code:'INVALID_PEER'}});
     result=await db.rpc('luo_agent_approve_peer',{p_actor:agent,p_other:body.peer});
    }else return sendJson(res,400,{error:{code:'INVALID_ACTION'}});
   }else if(req.method==='POST'){
    if(!uuid.test(body.to||'')||!uuid.test(body.id||'')||typeof body.text!=='string'||body.text.length>4000||!body.text.trim())return sendJson(res,400,{error:{code:'INVALID_MESSAGE'}});
    result=await db.rpc('luo_agent_send_peer_message',{p_sender:agent,p_recipient:body.to,p_client_id:body.id,p_text:body.text});
   }else{
    if(!uuid.test(body.peer||''))return sendJson(res,400,{error:{code:'INVALID_PEER'}});
    result=await db.rpc('luo_agent_read_peer_messages',{p_actor:agent,p_peer:body.peer,p_limit:30});
   }
   if(result.error){
    if(result.error.code==='P0001'){res.setHeader('Retry-After','60');return sendJson(res,429,{error:{code:'AGENT_RATE_LIMITED'}})}
    if(['28000','23505'].includes(result.error.code))return sendJson(res,403,{error:{code:'CONSENT_OR_IDENTITY_REQUIRED'}});
    throw Error('MESSAGE_DATABASE_UNAVAILABLE');
   }
   return sendJson(res,200,{result:result.data,identity_label:'AI Agent',quota:charged.data});
  }catch{logger.error('LUO_AGENT_MESSAGING_FAILED');return sendJson(res,503,{error:{code:'AGENT_MESSAGE_SERVICE_UNAVAILABLE'}})}
 };
}
