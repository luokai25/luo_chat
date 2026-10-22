import {SUPABASE_URL,SUPABASE_KEY} from '../src/config.js';
export function createHealthHandler({fetcher=fetch}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  try{
   const response=await fetcher(SUPABASE_URL+'/auth/v1/health',{headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(3000)});
   if(!response.ok)throw Error();
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=30');
   return res.status(200).json({status:'ok',checks:{web:'ok',auth:'reachable'}});
  }catch{return res.status(503).json({status:'degraded',checks:{web:'ok',auth:'unavailable'}});}
 };
}
export default createHealthHandler();
