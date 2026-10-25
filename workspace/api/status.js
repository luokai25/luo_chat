// Public operational facts only. No secrets, user data, or payment tokens.
// Private account metrics are fetched separately from owner-only Supabase RPC.
const headers={'Cache-Control':'public, s-maxage=60, stale-while-revalidate=120','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
async function read(url){const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Luo-Workspace/1.0'},signal:AbortSignal.timeout(5000)});if(!res.ok)throw new Error('source unavailable');return res.json()}
export default async function handler(req,res){
 for(const [key,value] of Object.entries(headers))res.setHeader(key,value);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'})}
 const tasks=await Promise.allSettled([
  read('https://api.github.com/repos/luokai25/luo_chat/actions/runs?per_page=14'),
  read('https://luo-chat-luokai25.vercel.app/api/health'),
  read('https://luo-chat-luokai25.vercel.app/api/v1/plans'),
  fetch('https://luo-chat-luokai25.vercel.app/',{method:'HEAD',signal:AbortSignal.timeout(5000)}).then(r=>({status:r.status}))
 ]);
 const ok=i=>tasks[i].status==='fulfilled';
 return res.status(200).json({
  collected_at:new Date().toISOString(),
  site:ok(3)?tasks[3].value:{status:null},
  health:ok(1)?{status:tasks[1].value.status,checks:tasks[1].value.checks}:{status:'unavailable'},
  plans:ok(2)?{billing_enabled:tasks[2].value.billing_enabled===true}:{billing_enabled:false},
  runs:ok(0)&&Array.isArray(tasks[0].value.workflow_runs)?tasks[0].value.workflow_runs.map(r=>({
   id:r.id,name:String(r.name||'').slice(0,110),status:r.status,conclusion:r.conclusion,
   html_url:r.html_url,head_branch:r.head_branch,created_at:r.created_at,head_sha:String(r.head_sha||'').slice(0,40)
  })):[]
 });
}
