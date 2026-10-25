import {createHmac} from 'node:crypto';
// Shared storage, not per-instance memory. No raw account IDs are sent to Redis.
const lua="local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],120) end;if n>12 then return 0 end;local d=redis.call('INCR',KEYS[2]);if d==1 then redis.call('EXPIRE',KEYS[2],172800) end;if d>2400 then return 0 end;return 1";
export async function consumeRelayQuota({env,actor,fetcher=fetch,now=Date.now}){
 const url=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN,salt=env.LUO_RELAY_QUOTA_SALT;
 if(!url||!token||!salt)return 'unavailable';
 try{const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password)return 'unavailable';const time=now(),digest=createHmac('sha256',salt).update(String(actor)).digest('hex');
  const response=await fetcher(target.href,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',lua,'2',`luo:relay:minute:${Math.floor(time/60000)}:${digest}`,`luo:relay:day:${Math.floor(time/86400000)}`]),signal:AbortSignal.timeout(2000)});
  if(!response.ok)return 'unavailable';const result=await response.json();return !result.error&&result.result===1?'allowed':!result.error&&result.result===0?'limited':'unavailable';
 }catch{return 'unavailable'}
}
