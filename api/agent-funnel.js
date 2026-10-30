import {createHmac,randomUUID} from 'node:crypto';

const ALLOWED = new Set([
 'agent_guide_view','verification_page_view','verification_start_clicked',
 'verification_finish_submitted','registration_page_view','registration_submitted',
 'checkout_page_view','checkout_attempted','checkout_created','checkout_resumed',
 'checkout_status_checked','checkout_paid_confirmed','checkout_canceled'
]);
const ROUTES = new Set(['/agents','/agent-verification','/agent-checkout']);
const QUOTA_SCRIPT = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],300) end; if n>30 then return 0 end; local d=redis.call('INCR',KEYS[2]); if d==1 then redis.call('EXPIRE',KEYS[2],172800) end; if d>1500 then return 0 end; return 1`;
const json=(res,status,body)=>res.status(status).json(body);
export function createAgentFunnelHandler({env=process.env,fetcher=fetch,now=Date.now,logger=console}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Method not allowed'})}
  if(req.headers?.origin!=='https://luo-chat-luokai25.vercel.app')return json(res,403,{error:'Origin not allowed'});
  if(!/^application\\/json(?:\\s*;|$)/i.test(req.headers?.['content-type']||''))return json(res,415,{error:'JSON required'});
  let b=req.body;
  try{if(typeof b==='string'){if(Buffer.byteLength(b)>1024)throw Error();b=JSON.parse(b)}}catch{return json(res,400,{error:'Invalid payload'})}
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['event','session_id','path','campaign'].includes(k))
   ||!ALLOWED.has(b.event)||typeof b.session_id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.session_id)
   ||!ROUTES.has(b.path)||b.campaign!==undefined&&(!['utm_source','utm_medium','utm_campaign'].every(k=>b.campaign[k]===undefined||typeof b.campaign[k]==='string'&&/^[a-zA-Z0-9._-]{1,80}$/.test(b.campaign[k]))||Object.keys(b.campaign).some(k=>!['utm_source','utm_medium','utm_campaign'].includes(k))))
   return json(res,400,{error:'Invalid payload'});
  const {UPSTASH_REDIS_REST_URL:url,UPSTASH_REDIS_REST_TOKEN:token,LUO_TELEMETRY_SALT:salt,LUO_POSTHOG_KEY:key}=env;
  if(!url||!token||!salt||!key)return res.status(204).end();
  const ip=String(req.headers['x-vercel-forwarded-for']||'unknown').split(',')[0].trim();
  const day=Math.floor(now()/86400000),window=Math.floor(now()/300000);
  const hash=createHmac('sha256',salt).update(day+':'+ip).digest('hex');
  try{
   const quota=await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(['EVAL',QUOTA_SCRIPT,'2',`luo:funnel:ip:${window}:${hash}`,`luo:funnel:day:${day}`]),signal:AbortSignal.timeout(2000)});
   if(!quota.ok)throw Error();const qr=await quota.json();if(qr.error)throw Error();
   if(qr.result!==1){res.setHeader('Retry-After','300');return json(res,429,{error:'Analytics limit reached'})}
   const properties={distinct_id:b.session_id,session_id:b.session_id,event_id:randomUUID(),step:b.event,path:b.path,
    release:'15.3.0',$process_person_profile:false,$ip:'0.0.0.0'};
   if(b.campaign)for(const k of ['utm_source','utm_medium','utm_campaign'])if(b.campaign[k])properties[k]=b.campaign[k];
   const captured=await fetcher('https://us.i.posthog.com/i/v0/e/',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({api_key:key,event:'luo_agent_funnel',properties}),signal:AbortSignal.timeout(2500)});
   if(!captured.ok)throw Error();
   return res.status(204).end();
  }catch{logger.error('LUO_AGENT_FUNNEL_UNAVAILABLE');return json(res,503,{error:'Analytics unavailable'})}
 }
}
export default createAgentFunnelHandler();
