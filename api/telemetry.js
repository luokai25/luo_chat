import {createHmac} from 'node:crypto';
const CODES=new Set(['CLIENT_RUNTIME_ERROR','CLIENT_UNHANDLED_REJECTION','INTEGRATION_SELF_TEST']);
// One atomic command enforces short-lived IP and global ingestion ceilings.
export const QUOTA_SCRIPT=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],300) end; if n>20 then return 0 end; local d=redis.call('INCR',KEYS[2]); if d==1 then redis.call('EXPIRE',KEYS[2],172800) end; if d>1000 then return 0 end; return 1`;
export function createTelemetryHandler({env=process.env,fetcher=fetch,now=Date.now,logger=console}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  if(req.headers.origin!=='https://luo-chat-luokai25.vercel.app')return res.status(403).json({error:'Origin not allowed'});
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'JSON required'});
  if(Number(req.headers['content-length']||0)>128)return res.status(413).json({error:'Payload too large'});
  let body=req.body;try{if(typeof body==='string'){if(Buffer.byteLength(body)>128)throw Error();body=JSON.parse(body);}}catch{return res.status(400).json({error:'Invalid payload'});}
  if(!body||Array.isArray(body)||Object.keys(body).length!==1||!CODES.has(body.code))return res.status(400).json({error:'Invalid payload'});
  const {UPSTASH_REDIS_REST_URL:url,UPSTASH_REDIS_REST_TOKEN:token,LUO_TELEMETRY_SALT:salt,LUO_POSTHOG_KEY:key}=env;
  if(!url||!token||!salt||!key)return res.status(204).end();
  // Vercel overwrites x-vercel-forwarded-for; never trust arbitrary forwarded IPs.
  const ip=String(req.headers['x-vercel-forwarded-for']||'unknown').split(',')[0].trim();
  const day=Math.floor(now()/86400000),window=Math.floor(now()/300000);
  const hash=createHmac('sha256',salt).update(day+':'+ip).digest('hex');
  try{
   const quota=await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',QUOTA_SCRIPT,'2',`luo:telemetry:ip:${window}:${hash}`,`luo:telemetry:day:${day}`]),signal:AbortSignal.timeout(2000)});
   if(!quota.ok)throw Error();const result=await quota.json();if(result.error)throw Error();
   if(result.result!==1){res.setHeader('Retry-After','300');return res.status(429).json({error:'Telemetry limit reached'});}
   const capture=await fetcher('https://us.i.posthog.com/i/v0/e/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,event:body.code==='INTEGRATION_SELF_TEST'?'luo_integration_check':'luo_client_error',properties:{distinct_id:'luo-web-diagnostics',code:body.code,release:'15.3.0',$process_person_profile:false,$ip:'0.0.0.0'}}),signal:AbortSignal.timeout(2500)});
   if(!capture.ok)throw Error();return res.status(204).end();
  }catch{logger.error('LUO_TELEMETRY_UNAVAILABLE');return res.status(503).json({error:'Diagnostics unavailable'});}
 };
}
export default createTelemetryHandler();
