// Fixed targets only. No credentials, message data, public refresh or arbitrary URL fetches.
export const TARGETS=[['web','https://luo-chat-luokai25.vercel.app/'],['auth','https://luo-chat-luokai25.vercel.app/api/health']];
export async function checkTargets(fetcher=fetch,now=Date.now){
 const checks=await Promise.all(TARGETS.map(async([name,url])=>{
  const started=now();try{
   const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Cache-Control':'no-cache'}});
   let ok=response.status===200;
   if(ok&&name==='auth'){const data=await response.json();ok=data.status==='ok'&&data.checks?.auth==='reachable';}
   if(ok&&name==='web'){const html=await response.text();ok=html.includes('Luo Chat')&&html.includes('luo-version');}
   return{name,status:ok?'up':'down',httpStatus:response.status,latencyMs:Math.max(0,now()-started)};
  }catch{return{name,status:'down',httpStatus:0,latencyMs:Math.max(0,now()-started)};}
 }));return{checkedAt:new Date(now()).toISOString(),status:checks.every(x=>x.status==='up')?'up':'degraded',checks};
}
export default{
 async scheduled(controller,env){
  const sample=await checkTargets();let old;try{old=await env.STATUS.get('history','json');}catch{}
  const history=[...(Array.isArray(old)?old:[]),sample].slice(-288);
  await env.STATUS.put('history',JSON.stringify(history),{expirationTtl:172800});
  if(sample.status!=='up')console.error('LUO_UPTIME_DEGRADED');
 },
 async fetch(request,env){
  const headers={'Content-Type':'application/json','Cache-Control':'public, max-age=60','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'};
  if(request.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...headers,Allow:'GET'}});
  if(new URL(request.url).pathname!=='/status.json')return new Response(JSON.stringify({service:'Luo Chat availability',statusPath:'/status.json'}),{headers});
  try{
   const history=await env.STATUS.get('history','json'),samples=Array.isArray(history)?history:[],latest=samples.at(-1);
   const stale=!latest||Date.now()-Date.parse(latest.checkedAt)>900000;
   return new Response(JSON.stringify({status:stale?'unknown':latest.status,stale,latest:latest||null,samples:samples.length,successfulSamples:samples.filter(x=>x.status==='up').length}),{headers,status:stale||latest.status!=='up'?503:200});
  }catch{return new Response(JSON.stringify({status:'unknown',stale:true}),{status:503,headers});}
 }
};
