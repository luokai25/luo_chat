import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
const projectUrl=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const deadlineFetch=(input:string,init:RequestInit={})=>fetch(input,{...init,signal:AbortSignal.timeout(8000)});
async function rows(table:string,query:string){const r=await deadlineFetch(`${projectUrl}/rest/v1/${table}?${query}`,{headers});if(!r.ok)throw Error('Database request failed');return await r.json()}
async function acknowledge(id:number){const r=await deadlineFetch(`${projectUrl}/rest/v1/storage_cleanup_queue?id=eq.${id}`,{method:'DELETE',headers});if(!r.ok)throw Error('Queue acknowledgement failed')}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 try{
  let allowed=!!serviceKey&&req.headers.get('authorization')===`Bearer ${serviceKey}`;
  if(!allowed){const token=req.headers.get('x-luo-cleanup-token')||'';if(!/^[a-f0-9]{64}$/.test(token))return reply(403,{error:'Forbidden'});
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const config=await rows('chat_cleanup_worker_config','select=token_sha256&id=eq.true&limit=1');
   allowed=!!config[0]&&digest===config[0].token_sha256;
  }
  if(!allowed)return reply(403,{error:'Forbidden'});
  const cutoff=new Date(Date.now()-300000).toISOString();
  const jobs=await rows('storage_cleanup_queue','select=id,bucket_id,object_path,attempts&attempts=lt.10&order=queued_at.asc,id.asc&limit=25&queued_at=lt.'+encodeURIComponent(cutoff));
  const started=Date.now();let processed=0,removed=0,failed=0,retained=0;
  for(const job of jobs){if(Date.now()-started>35000)break;processed++;try{
   if(!['chat-media','avatars','luo-stories','luo-vault'].includes(job.bucket_id))throw Error('Unsupported cleanup bucket');
   const path=encodeURIComponent(job.object_path);
   let referenced=false;
   if(job.bucket_id==='chat-media')referenced=(await rows('chat_attachments','select=id&object_path=eq.'+path+'&limit=1')).length>0||(await rows('chat_file_library','select=id&object_path=eq.'+path+'&limit=1')).length>0;
   if(job.bucket_id==='luo-stories')referenced=(await rows('chat_stories','select=id&media_path=eq.'+path+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1')).length>0;
   if(job.bucket_id==='luo-vault')referenced=(await rows('chat_vault_files','select=id&object_path=eq.'+path+'&limit=1')).length>0;
   if(job.bucket_id==='avatars')referenced=(await rows('profiles','select=id&avatar_url=like.'+encodeURIComponent('%'+job.object_path)+'&limit=1')).length>0;
   if(referenced){await acknowledge(job.id);retained++;continue}
   const r=await deadlineFetch(`${projectUrl}/storage/v1/object/${encodeURIComponent(job.bucket_id)}`,{method:'DELETE',headers,body:JSON.stringify({prefixes:[job.object_path]})});
   if(!r.ok&&r.status!==404)throw Error('Storage removal failed with status '+r.status);
   await acknowledge(job.id);removed++;
  }catch(e){failed++;await deadlineFetch(`${projectUrl}/rest/v1/storage_cleanup_queue?id=eq.${job.id}`,{method:'PATCH',headers,body:JSON.stringify({attempts:(job.attempts||0)+1,last_error:'LUO_CLEANUP_ITEM_FAILED',queued_at:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts||0,7))).toISOString()})}).catch(()=>console.error('LUO_CLEANUP_RETRY_UPDATE_FAILED'))}}
  return reply(200,{processed,removed,retained,failed});
 }catch{return reply(502,{error:'Cleanup worker unavailable'})}
});
