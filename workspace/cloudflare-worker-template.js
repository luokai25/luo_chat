// Source template for Luo Workspace Cloudflare Worker.
// Deployment script replaces __HTML__, __CSS__ and __APP__ with JSON strings
// read from source files in this directory. No credentials are embedded.
const html=__HTML__;
const css=__CSS__;
const app=__APP__;
const insights=__INSIGHTS__;
const headers={
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'no-referrer',
 'X-Robots-Tag':'noindex, nofollow',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; connect-src 'self' https://byjixqwpjvsgmqilmzbm.supabase.co wss://byjixqwpjvsgmqilmzbm.supabase.co; img-src 'self' data:; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests"
};
function respond(body,type,status=200,extra={}){
 return new Response(body,{status,headers:{...headers,'Content-Type':type,'Cache-Control':'no-store',...extra}});
}
async function getJSON(url){
 const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Luo-Workspace/1.0'},signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw Error('REMOTE_SERVICE_UNAVAILABLE');
 return r.json();
}
async function statusResponse(){
 const sources=await Promise.allSettled([
  getJSON('https://api.github.com/repos/luokai25/luo_chat/actions/runs?per_page=14'),
  getJSON('https://luo-chat-luokai25.vercel.app/api/health'),
  getJSON('https://luo-chat-luokai25.vercel.app/api/v1/plans'),
  fetch('https://luo-chat-luokai25.vercel.app/',{method:'HEAD',signal:AbortSignal.timeout(6000)}).then(r=>({status:r.status}))
 ]);
 const ok=n=>sources[n].status==='fulfilled';
 const output={
  collected_at:new Date().toISOString(),
  site:ok(3)?sources[3].value:{status:null},
  health:ok(1)?{status:sources[1].value.status,checks:sources[1].value.checks}:{status:'unavailable'},
  plans:ok(2)?{billing_enabled:sources[2].value.billing_enabled===true}:{billing_enabled:false},
  runs:ok(0)&&Array.isArray(sources[0].value.workflow_runs)?sources[0].value.workflow_runs.map(r=>({
   id:r.id,name:String(r.name||'').slice(0,110),status:r.status,conclusion:r.conclusion,
   html_url:r.html_url,head_branch:r.head_branch,created_at:r.created_at,head_sha:String(r.head_sha||'').slice(0,40)
  })):[]
 };
 return respond(JSON.stringify(output),'application/json; charset=utf-8',200,{'Cache-Control':'public, max-age=30, s-maxage=45'});
}
addEventListener('fetch',event=>event.respondWith((async()=>{
 const req=event.request,path=new URL(req.url).pathname;
 if(req.method!=='GET'&&req.method!=='HEAD')return respond('Method Not Allowed','text/plain; charset=utf-8',405,{'Allow':'GET, HEAD'});
 if(path==='/api/status')return statusResponse();
 if(path==='/'||path==='/index.html')return respond(req.method==='HEAD'?null:html,'text/html; charset=utf-8');
 if(path==='/style.css')return respond(req.method==='HEAD'?null:css,'text/css; charset=utf-8',200,{'Cache-Control':'public, max-age=300'});
 if(path==='/app.js')return respond(req.method==='HEAD'?null:app,'application/javascript; charset=utf-8',200,{'Cache-Control':'public, max-age=300'});
 if(path==='/insights.js')return respond(req.method==='HEAD'?null:insights,'application/javascript; charset=utf-8',200,{'Cache-Control':'public, max-age=300'});
 if(path==='/favicon.ico')return new Response(null,{status:204,headers});
 return respond('Not Found','text/plain; charset=utf-8',404);
})()));
