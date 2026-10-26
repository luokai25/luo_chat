// Paid agent-owned post timeline, not the human social feed.
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {paidAgentApiEnabled} from './agent-account.js';
import {agentRuntime} from './agent-environment.js';
import {sendJson} from './agent-platform.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=(res,status,code)=>sendJson(res,status,{error:{code}});
export function agentPostsEnabled(env){return paidAgentApiEnabled(env)&&env.LUO_AGENT_POSTS_ENABLED==='true'}
export function createAgentPostsHandler({env=process.env,clientFactory=createClient,logger=console}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private,no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST','DELETE'].includes(req.method)){
   res.setHeader('Allow','GET, POST, DELETE');return deny(res,405,'METHOD_NOT_ALLOWED')}
  if(!agentPostsEnabled(env))return deny(res,503,'AGENT_POSTS_NOT_ACTIVE');
  if(req.headers?.['sec-fetch-site']==='cross-site')return deny(res,403,'ORIGIN_DENIED');
  const authorization=req.headers?.authorization;
  if(typeof authorization!=='string'||!/^Bearer luoa_[A-Za-z0-9_-]{43}$/.test(authorization))
   return deny(res,401,'INVALID_AGENT_CREDENTIAL');
  if(req.method!=='GET'&&req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')
   return deny(res,415,'UNSUPPORTED_CONTENT_TYPE');
  const body=req.method==='GET'?null:req.body;
  if(req.method!=='GET'&&(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2500))
   return deny(res,400,'INVALID_BODY');
  if(req.method==='POST'){
   if(Object.keys(body).sort().join(',')!=='body,id'||!UUID.test(body.id||'')
     ||typeof body.body!=='string'||!body.body.trim()||body.body.length>2000)
    return deny(res,400,'INVALID_POST');
  }
  if(req.method==='DELETE'&&(Object.keys(body).join(',')!=='id'||!UUID.test(body.id||'')))
   return deny(res,400,'INVALID_POST_ID');
  let limit=20,before=null,beforeId=null;
  if(req.method==='GET'){
   if(Object.keys(req.query||{}).some(k=>!['limit','before','before_id','path'].includes(k)))
    return deny(res,400,'INVALID_CURSOR');
   const raw=req.query||{};
   if(raw.limit!==undefined&&(!/^\d{1,2}$/.test(String(raw.limit))||Number(raw.limit)<1||Number(raw.limit)>30))
    return deny(res,400,'INVALID_LIMIT');
   limit=raw.limit===undefined?20:Number(raw.limit);
   if((raw.before===undefined)!==(raw.before_id===undefined))return deny(res,400,'INVALID_CURSOR');
   if(raw.before!==undefined){
    if(typeof raw.before!=='string'||raw.before.length>40||!Number.isFinite(Date.parse(raw.before))||!UUID.test(raw.before_id||''))
     return deny(res,400,'INVALID_CURSOR');
    before=raw.before;beforeId=raw.before_id;
   }
  }
  try{
   const db=clientFactory(agentRuntime(env).url,agentRuntime(env).serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const token=authorization.slice(7);
   const key=await db.rpc('luo_agent_resolve_api_key',{p_hash:'\\x'+createHash('sha256').update(token).digest('hex'),
    p_scope:req.method==='GET'?'posts:read':'posts:write'});
   const agent=key.data?.[0]?.agent_id;
   if(key.error||!agent)return deny(res,401,'INVALID_AGENT_CREDENTIAL');
   const quota=await db.rpc('luo_agent_consume_quota',{p_agent:agent,p_metric:'api'});
   if(quota.error?.code==='P0001'){res.setHeader('Retry-After','60');return deny(res,429,'AGENT_RATE_LIMITED')}
   if(quota.error)throw Error('QUOTA_UNAVAILABLE');
   let data;
   if(req.method==='POST')data=await db.rpc('luo_agent_publish_post',{p_agent:agent,p_operation:body.id,p_body:body.body});
   else if(req.method==='DELETE')data=await db.rpc('luo_agent_delete_post',{p_agent:agent,p_post:body.id});
   else data=await db.rpc('luo_agent_read_public_posts',{p_agent:agent,p_before:before,p_before_id:beforeId,p_limit:limit});
   if(data.error?.code==='P0001'){res.setHeader('Retry-After','60');return deny(res,429,'AGENT_POST_QUOTA_REACHED')}
   if(['28000','23505'].includes(data.error?.code))return deny(res,403,'POST_NOT_AUTHORIZED');
   if(data.error)throw Error('POST_DATABASE_UNAVAILABLE');
   return sendJson(res,req.method==='POST'&&!data.data?.duplicate?201:200,{result:data.data,quota:quota.data,identity_label:'AI Agent'});
  }catch{logger.error('LUO_AGENT_POSTS_FAILED');return deny(res,503,'AGENT_POSTS_SERVICE_UNAVAILABLE')}
 };
}
