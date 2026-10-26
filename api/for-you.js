import {rankAuthorizedFeed} from '../src/server/x-feed-ranker.js';
const MAX_TOKEN_LENGTH=8192;
const respond=(res,status,data)=>res.status(status).json(data);
async function defaultClient(token){
 const [{createClient},{SUPABASE_URL,SUPABASE_KEY}]=await Promise.all([
  import('@supabase/supabase-js'),import('../src/config.js')
 ]);
 return createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:'Bearer '+token}}
 });
}
/** OFF by default. Existing Supabase user-scoped RPC is access authority. */
export function createForYouHandler({makeClient=defaultClient,enabled=()=>process.env.LUO_RECOMMENDATIONS_ENABLED==='true',clock=()=>Date.now()}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return respond(res,405,{error:'Method not allowed'});}
  if(!enabled())return respond(res,503,{error:'Recommendations are not enabled'});
  const auth=req.headers?.authorization||req.headers?.Authorization;
  if(typeof auth!=='string'||!/^Bearer\s+\S+$/i.test(auth)||auth.length>MAX_TOKEN_LENGTH)
   return respond(res,401,{error:'Authentication required'});
  const raw=req.query?.limit;
  if(raw!==undefined&&(Array.isArray(raw)||! /^\d+$/.test(String(raw))))
   return respond(res,400,{error:'Invalid limit'});
  const token=auth.replace(/^Bearer\s+/i,'');
  const limit=Math.max(1,Math.min(40,Number(raw||20)));
  try{
   const db=await makeClient(token);
   const {data:{user}={},error:authError}=await db.auth.getUser(token);
   if(authError||!user?.id)return respond(res,401,{error:'Invalid session'});
   // Never trust a browser-declared age; wait for real server labeling.
   const age=await db.rpc('luo_my_age_safety');
   if(age.error||age.data?.enforced!==true||!['13-14','15-17','18+'].includes(age.data?.age_tier))
    return respond(res,503,{error:'Verified content safety is not ready'});
   const results=await Promise.all(['post','clip'].map(kind=>db.rpc('luo_space',{action:'feed',input:{mode:'public',kind}})));
   if(results.some(x=>x.error)||results.some(x=>!Array.isArray(x.data)))
    return respond(res,503,{error:'Feed temporarily unavailable'});
   const items=rankAuthorizedFeed(results.flatMap(x=>x.data),{now:clock(),limit});
   return respond(res,200,{items,ranker:'luo-local-v1',limit,has_more:false});
  }catch{return respond(res,503,{error:'Recommendation service unavailable'});}
 };
}
export default createForYouHandler();
