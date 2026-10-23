import {timedFetch,readRequestJSON} from '../_shared/http.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
const origins=new Set(['https://luo-chat-luokai25.vercel.app']);
function allowed(origin:string){return origins.has(origin)||/^https:\/\/luo-chat-luokai25-[a-z0-9]+-luokai25s-projects\.vercel\.app$/.test(origin)}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Origin':allowed(origin)?origin:'https://luo-chat-luokai25.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed.'});
 if(origin&&!allowed(origin))return reply(403,{error:'Origin not allowed.'});
 try{
 const body=await readRequestJSON(req),email=String(body.email||'').trim().toLowerCase(),action=String(body.action||'');
 if(action==='capabilities')return reply(200,{ok:true,username_signin:true,username_signup:false,username_recovery:false,feature_flags:{google_oauth:false,story_interactive:false},reason:'Username-only registration and recovery require the pending protected Supabase database migration.'});
 if(action==='signin_username'){
  const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
  if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<8||password.length>128)return reply(400,{error:'Enter a valid username and password.'});
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if(!url||!key||!serviceKey)return reply(503,{error:'Sign-in service temporarily unavailable.'});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
  // These headers must be normalized by the hosting gateway; username quota is
  // independent of IP and cannot be bypassed by rotating an IP header.
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
  if(!ip)return reply(503,{error:'Sign-in protection temporarily unavailable.'});
  const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serviceKey+':'+value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const ip_digest=await digest('ip:'+ip),email_digest=await digest('username:'+username);
  const limit=await admin.rpc('consume_auth_action_limit',{action_name:'signin',email_digest,ip_digest,max_email:6,max_ip:200,window_minutes:15});
  if(limit.error)return reply(503,{error:'Sign-in protection temporarily unavailable.'});
  if(limit.data!==true)return new Response(JSON.stringify({error:'Too many login attempts. Try again in 15 minutes.'}),{status:429,headers:{...headers,'Retry-After':'900'}});
  const start=Date.now(),invalid=async()=>{const pause=Math.max(0,350-(Date.now()-start));if(pause)await new Promise(resolve=>setTimeout(resolve,pause));return reply(401,{error:'Invalid username or password.'})};
  const profile=await admin.from('profiles').select('id').eq('username',username).maybeSingle();
  if(profile.error)return reply(503,{error:'Sign-in service temporarily unavailable.'});
  if(!profile.data?.id)return invalid();
  const found=await admin.auth.admin.getUserById(profile.data.id);
  if(found.error||!found.data?.user?.email)return reply(503,{error:'Sign-in service temporarily unavailable.'});
  // Credentials are verified exclusively by Supabase Auth, never in application SQL.
  const signed=await client.auth.signInWithPassword({email:found.data.user.email,password});
  if(signed.error){
   const status=Number(signed.error.status||0);
   if(status>=500||status===0)return reply(503,{error:'Sign-in service temporarily unavailable.'});
   if(status===429)return new Response(JSON.stringify({error:'Too many login attempts. Try again later.'}),{status:429,headers:{...headers,'Retry-After':'900'}});
   return invalid();
  }
  if(!signed.data?.session?.access_token||!signed.data.session.refresh_token)return reply(503,{error:'Sign-in session unavailable.'});
  return reply(200,{ok:true,access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token});
 }
 
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply(400,{error:'Enter a valid email.'});
 if(!['signup','reset','resend'].includes(action))return reply(400,{error:'Unknown action.'});
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}}),client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 if(!ip)return reply(503,{error:'Rate limiting unavailable. Try again later.'});
 const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serviceKey+':'+value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const email_digest=await digest('email:'+email),ip_digest=await digest('ip:'+ip);
 const limit=action==='signup'?await admin.rpc('consume_signup_rate_limit',{email_digest,ip_digest}):await admin.rpc('consume_auth_action_limit',{action_name:action==='reset'?'password_reset':'resend_confirmation',email_digest,ip_digest,max_email:3,max_ip:15,window_minutes:60});
 if(limit.error)return reply(503,{error:'Rate limiting unavailable. Try again later.'});if(limit.data!==true)return new Response(JSON.stringify({error:'Too many requests. Try again later.'}),{status:429,headers:{...headers,'Retry-After':'3600'}});
 const requested=typeof body.redirect_to==='string'?body.redirect_to:'';let redirect='https://luo-chat-luokai25.vercel.app/';
 try{const parsed=new URL(requested);if(allowed(parsed.origin))redirect=parsed.origin+'/?auth='+(action==='reset'?'recovery':'confirmed')}catch{}
 // Keep transport/SMTP failures distinct from account-specific validation.
 // Recovery/resend responses for unknown accounts remain deliberately generic.
 const sendEmail=async(operation:()=>Promise<any>)=>{try{return await operation()}catch{return {error:{status:503}}}};
 const emailFailure=(error:any)=>{
  if(!error)return null;
  if(error.status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code))return new Response(JSON.stringify({error:'Too many email requests. Try again shortly.'}),{status:429,headers:{...headers,'Retry-After':'60'}});
  if(!Number.isFinite(error.status)||error.status===0||error.status>=500||error.code==='email_address_not_authorized')return reply(503,{error:'Email service unavailable. Try again later.'});
  return null;
 };
 if(action==='signup'){
  const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
  if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<8||password.length>128)return reply(400,{error:'Use a valid username and a password of 8–128 characters.'});
  const existing=await admin.from('profiles').select('id').eq('username',username).maybeSingle();if(existing.error)return reply(503,{error:'Profile lookup failed.'});if(existing.data)return reply(409,{error:'That username is already taken.'});
  const {error}=await sendEmail(()=>client.auth.signUp({email,password,options:{emailRedirectTo:redirect,data:{username,display_name:username}}}));
  const failure=emailFailure(error);if(failure)return failure;
  if(error)return reply(400,{error:'Account creation could not finish. Check your details or try again later.'});
 }else if(action==='reset'){
  const {error}=await sendEmail(()=>client.auth.resetPasswordForEmail(email,{redirectTo:redirect}));
  const failure=emailFailure(error);if(failure)return failure;
 }else{
  const {error}=await sendEmail(()=>client.auth.resend({type:'signup',email,options:{emailRedirectTo:redirect}}));
  const failure=emailFailure(error);if(failure)return failure;
 }
 return reply(200,{ok:true,message:'If eligible, check your email.'});
 }catch{return reply(400,{error:'Request could not be processed.'})}
});
