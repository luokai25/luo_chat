// Staging-only HTTPS facade for Luo For You. Never uses a Supabase service-role key.
// Source candidates come *only* from the existing actor-scoped luo_space RPC.
import {createClient} from '@supabase/supabase-js';
import {rankLuoFeed,LUO_RANKER_VERSION} from './luo-for-you.js';
import {sendJson} from './agent-platform.js';
const STAGING_URL='https://itecovbwilcrvjqkdoyd.supabase.co';
const BRANCH='feature/agent-autonomous-onboarding-20261026';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_KEYS=new Set(['post:friends','post:public','clip:friends','clip:public']);
const failure=(res,status,code)=>sendJson(res,status,{error:{code}});
export function recommendationRuntime(env={}){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
 env.LUO_RECOMMENDATIONS_ENABLED!=='true'||env.LUO_RECOMMENDATIONS_STAGING_URL!==STAGING_URL||
 typeof env.LUO_RECOMMENDATIONS_STAGING_PUBLISHABLE_KEY!=='string'||
 env.LUO_RECOMMENDATIONS_STAGING_PUBLISHABLE_KEY.length<24)return null;
 return {url:STAGING_URL,key:env.LUO_RECOMMENDATIONS_STAGING_PUBLISHABLE_KEY};
}
function parseCursor(v){
 if(v===undefined||v==='')return {};
 if(typeof v!=='string'||v.length>1100||!/^[A-Za-z0-9_-]+$/.test(v))return null;
 try{
  const raw=Buffer.from(v,'base64url');if(raw.length>800||raw.toString('base64url')!==v)return null;
  const obj=JSON.parse(raw.toString('utf8'));
  if(!obj||Array.isArray(obj)||obj.v!==1||!obj.positions||typeof obj.positions!=='object'||Array.isArray(obj.positions))return null;
  const result={};for(const [name,pos] of Object.entries(obj.positions)){
   if(!CURSOR_KEYS.has(name)||!pos||!UUID.test(pos.id||'')||
   typeof pos.time!=='string'||pos.time.length>40||!Number.isFinite(Date.parse(pos.time)))return null;
   result[name]={before:pos.time,before_id:pos.id};
  }
  return result;
 }catch{return null}
}
const encodeCursor=positions=>Buffer.from(JSON.stringify({v:1,positions})).toString('base64url');
function bear(req){
 const val=req.headers?.authorization;
 if(typeof val!=='string'||val.length>4300||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(val))return null;
 return val.slice(7);
}
function safeOrigin(req){
 if(req.headers?.['sec-fetch-site']==='cross-site')return false;
 const origin=req.headers?.origin;
 if(!origin)return true;
 return typeof origin==='string'&&typeof req.headers?.host==='string'&&
 origin==='https://'+req.headers.host;
}
export function createRecommendationHandler({mode='feed',env=process.env,clientFactory=createClient,logger=console}={}){
 if(!['feed','feedback'].includes(mode))throw Error('Unsupported recommendation handler');
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Authorization');
  res.setHeader('X-Content-Type-Options','nosniff');
  const method=mode==='feed'?'GET':'POST';
  if(req.method!==method){res.setHeader('Allow',method);return failure(res,405,'METHOD_NOT_ALLOWED')}
  const runtime=recommendationRuntime(env);
  if(!runtime){res.setHeader('Retry-After','3600');return failure(res,503,'RECOMMENDATIONS_NOT_ENABLED')}
  if(!safeOrigin(req))return failure(res,403,'ORIGIN_DENIED');
  const token=bear(req);if(!token)return failure(res,401,'AGENT_OR_USER_TOKEN_REQUIRED');
  let client;
  try{client=clientFactory(runtime.url,runtime.key,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token}}
  });}catch{return failure(res,503,'RECOMMENDATIONS_SERVICE_UNAVAILABLE')}
  try{
   // Verify JWT with Supabase Auth; never trust a browser-provided user id.
   const auth=await client.auth.getUser(token);
   if(auth.error||!UUID.test(auth.data?.user?.id||''))return failure(res,401,'AUTH_REQUIRED');
   if(mode==='feedback'){
    const body=req.body;
    if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json'||
      !body||typeof body!=='object'||Array.isArray(body)||
      Object.keys(body).sort().join(',')!=='action,entry_id'||
      !UUID.test(body.entry_id||'')||!['hide','unhide','not_interested'].includes(body.action))
      return failure(res,400,'INVALID_FEEDBACK');
    const result=await client.rpc('luo_recommend_feedback',{p_entry:body.entry_id,p_action:body.action});
    if(result.error){if(result.error.code==='P0001')return failure(res,429,'RATE_LIMITED');throw Error('FEEDBACK_RPC_FAILED')}
    return sendJson(res,200,{ok:true});
   }
   // Age must be established by a server-controlled policy, not browser flags or
   // user-entered profile metadata. Labels must actually be applied to every
   // candidate by the authorization layer before we enable personalized feeds.
   const safety=await client.rpc('luo_my_age_safety');
   if(safety.error||safety.data?.enforced!==true||safety.data?.content_filter_applied!==true||
    !['12','13-14','15-17','18+'].includes(safety.data?.age_tier))
    return failure(res,503,'AGE_SAFETY_NOT_READY');
   const view=req.query?.view??'for_you',kind=req.query?.kind??'mixed';
   if(!['for_you','friends'].includes(view)||!['mixed','post','clip'].includes(kind))return failure(res,400,'INVALID_FEED_QUERY');
   const current=parseCursor(req.query?.cursor);
   if(current===null)return failure(res,400,'INVALID_CURSOR');
   const ctxResult=await client.rpc('luo_recommend_context');
   if(ctxResult.error){if(ctxResult.error.code==='P0001')return failure(res,429,'RATE_LIMITED');throw Error('CONTEXT_RPC_FAILED')}
   const context=ctxResult.data;
   if(!context||!Array.isArray(context.hidden_ids)||!Array.isArray(context.served_ids))throw Error('INVALID_CONTEXT');
   const sources=[],next={};let hasMore=false;
   const kinds=kind==='mixed'?['post','clip']:[kind],modes=view==='friends'?['friends']:['friends','public'];
   const plans=kinds.flatMap(type=>modes.map(source=>({kind:type,source,key:type+':'+source})));
   const responses=await Promise.all(plans.map(async plan=>{
    const input={kind:plan.kind,mode:plan.source,...(current[plan.key]||{})};
    const result=await client.rpc('luo_space',{action:'feed',input});
    if(result.error||!Array.isArray(result.data))throw Error('AUTHORISED_SOCIAL_FEED_UNAVAILABLE');
    return {plan,rows:result.data};
   }));
   for(const {plan,rows} of responses){
    sources.push({source:plan.source,items:rows});
    if(rows.length===20){
     const last=rows.at(-1);
     if(!UUID.test(last?.id||'')||!Number.isFinite(Date.parse(last?.created_at||'')))throw Error('INVALID_CURSOR_SOURCE');
     next[plan.key]={id:last.id,time:last.created_at};hasMore=true;
    }
   }
   const {items,reasons,diagnostic}=rankLuoFeed({sources,context,limit:20});
   if(items.length){
    const saved=await client.rpc('luo_recommend_mark_served',{p_ids:items.map(i=>i.id)});
    if(saved.error?.code==='P0001')return failure(res,429,'RATE_LIMITED');
    if(saved.error)throw Error('MARK_SERVED_FAILED');
   }
   return sendJson(res,200,{items,why:reasons,has_more:hasMore,
    cursor:hasMore?encodeCursor(next):null,
    algorithm:LUO_RANKER_VERSION,
    counts:{candidates:diagnostic.retrieved,eligible:diagnostic.visible,returned:items.length}});
  }catch{
   logger.error('LUO_RECOMMENDATIONS_REQUEST_FAILED');
   return failure(res,503,'RECOMMENDATIONS_SERVICE_UNAVAILABLE');
  }
 };
}
