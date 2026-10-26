// Read-only Luo Chat recommendations API, default-off for production.
// Uses the viewer's *own* Supabase JWT and publishable key, never service_role.
// The luo_space RPC is the authoritative authorization, block/privacy, and
// (when enabled) age-safety filter. Ranking cannot grant a content entitlement.
import {createClient} from '@supabase/supabase-js';
import {rankAuthorizedFeed,feedCursorFromRows,RANKER_VERSION} from '../src/server/luo-recommendation-ranker.js';

const MODES=new Set(['public','friends']),KINDS=new Set(['post','clip']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRUSTED_PRODUCTION_ORIGIN='https://luo-chat-luokai25.vercel.app';
const TRUSTED_PREVIEW_ORIGIN=/^https:\/\/luo-chat-luokai25-[a-z0-9]+-luokai25s-projects\.vercel\.app$/;
const TOKEN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const POST_LIMIT=20;
const BUCKETS=new Map(); // Opportunistic per-isolate limit; production requires durable edge quota.
const send=(res,status,payload)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Authorization');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 return res.status(status).json(payload);
};
const fail=(res,status,code)=>send(res,status,{error:{code}});
export function recommendationEnabled(env={}){
 return env.VERCEL_ENV==='production'?env.LUO_FEED_RANKING_ENABLED==='true':
 env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='feature/luonix-x-ranking-20261026';
}
export function validateRankingRequest(req,env={}){
 if(req.method!=='POST')return {status:405,code:'METHOD_NOT_ALLOWED'};
 if(req.headers?.['sec-fetch-site']==='cross-site')return {status:403,code:'ORIGIN_DENIED'};
 const origin=req.headers?.origin;
 if(origin){
  if(env.VERCEL_ENV==='production'&&origin!==TRUSTED_PRODUCTION_ORIGIN
   ||env.VERCEL_ENV==='preview'&&!TRUSTED_PREVIEW_ORIGIN.test(origin))
   return {status:403,code:'ORIGIN_DENIED'};
 }
 if(req.headers?.['content-type']?.split(';')[0]?.trim()!=='application/json')return {status:415,code:'UNSUPPORTED_CONTENT_TYPE'};
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>600
  ||Object.keys(body).some(k=>!['kind','mode','before','before_id'].includes(k)))
  return {status:400,code:'INVALID_REQUEST'};
 if(!KINDS.has(body.kind)||!MODES.has(body.mode))return {status:400,code:'INVALID_FEED'};
 if((body.before===undefined)!==(body.before_id===undefined))return {status:400,code:'INVALID_CURSOR'};
 if(body.before!==undefined){
  if(typeof body.before!=='string'||body.before.length>48||!Number.isFinite(Date.parse(body.before))
   ||typeof body.before_id!=='string'||!UUID.test(body.before_id))return {status:400,code:'INVALID_CURSOR'};
 }
 return {body};
}
function limited(actor,now=Date.now()){
 // Only a best-effort instance-local guard. Production rollout remains disabled
 // until a durable multi-instance per-user rate limit is provisioned.
 if(BUCKETS.size>1500)BUCKETS.clear();
 const interval=Math.floor(now/60000),key=actor+':'+interval;
 const uses=(BUCKETS.get(key)||0)+1;BUCKETS.set(key,uses);
 return uses>30;
}
export function createRecommendationHandler({
 env=process.env,
 clientFactory=createClient,
 now=()=>Date.now(),
 logger=console,
 rateLimit=limited,
}={}){
 return async(req,res)=>{
  const validation=validateRankingRequest(req,env);
  if(validation.status){if(validation.status===405)res.setHeader('Allow','POST');return fail(res,validation.status,validation.code)}
  if(!recommendationEnabled(env))return fail(res,503,'RANKING_NOT_ACTIVATED');
  const auth=typeof req.headers?.authorization==='string'?req.headers.authorization:'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(token.length<40||token.length>8192||!TOKEN.test(token))return fail(res,401,'AUTH_REQUIRED');
  const url=env.SUPABASE_URL;
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
  if(typeof url!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)
   ||typeof key!=='string'||key.length<24)return fail(res,503,'RANKING_SERVICE_UNAVAILABLE');
  try{
   const client=clientFactory(url,key,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token}}
   });
   // Supabase verifies a fresh user JWT on the server. Never decode untrusted
   // browser metadata or use the JWT payload for content authorization.
   const user=await client.auth.getUser(token);
   if(user.error||!user.data?.user?.id)return fail(res,401,'AUTH_REQUIRED');
   if(rateLimit(user.data.user.id,now())){res.setHeader('Retry-After','60');return fail(res,429,'RANKING_RATE_LIMITED')}
   const {mode,kind,before,before_id}=validation.body;
   const input={mode,kind,...(before?{before,before_id}:{})};
   const result=await client.rpc('luo_space',{action:'feed',input});
   if(result.error||!Array.isArray(result.data)){
    logger.warn?.('LUO_RANKING_AUTHORIZED_FEED_UNAVAILABLE');
    return fail(res,503,'RANKING_SERVICE_UNAVAILABLE');
   }
   const authorized=result.data.slice(0,POST_LIMIT);
   const ranked=rankAuthorizedFeed(authorized,{kind,mode,now:now()});
   return send(res,200,{
    model:RANKER_VERSION,items:ranked,more:authorized.length===POST_LIMIT,
    cursor:feedCursorFromRows(authorized),
    authorized_by:'luo_space',
    safety_rules:'existing_server_visibility',
    trained_phoenix_model:false
   });
  }catch{
   logger.warn?.('LUO_RANKING_BACKEND_FAILURE');
   return fail(res,503,'RANKING_SERVICE_UNAVAILABLE');
  }
 };
}
export default createRecommendationHandler();
