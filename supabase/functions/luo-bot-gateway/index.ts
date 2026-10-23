import {timedFetch,readRequestJSON} from '../_shared/http.ts';
import {canonicalBotUsername} from '../_shared/bot-policy.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';

/**
 * Isolated bot gateway. Bots NEVER get Supabase Auth refresh/access tokens.
 * A bot gets only a 256-bit generated password, recognized solely here.
 * Production activation requires paid subscription, manual safety approval,
 * user consent and an actual bot identity wired to restricted chat actions.
 */
const origins=new Set(['https://luo-chat-luokai25.vercel.app']);
const isAllowedOrigin=(value:string)=>origins.has(value);
const bytesToHex=(bytes:Uint8Array)=>Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
async function hmac(secret:string,material:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(material))));
}
function constantTimeHexEq(a:string,b:string){
 if(!/^[a-f0-9]{64}$/.test(a)||!/^[a-f0-9]{64}$/.test(b))return false;
 let difference=0;for(let i=0;i<64;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
 return difference===0;
}
function strongPassword(){
 const raw=crypto.getRandomValues(new Uint8Array(32));
 return 'luob_'+btoa(String.fromCharCode(...raw)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':isAllowedOrigin(origin)?origin:'https://luo-chat-luokai25.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST'||(origin&&!isAllowedOrigin(origin)))return reply(403,{error:'Request not allowed.'});
 let body:Record<string,unknown>;
 try{body=await readRequestJSON(req,8192) as Record<string,unknown>}catch{return reply(400,{error:'Invalid request.'})}
 const action=String(body.action||'');
 if(!['apply','issue_password','bot_auth','read_assigned_thread'].includes(action))return reply(400,{error:'Action not supported.'});
 const url=Deno.env.get('SUPABASE_URL')||'',publishable=Deno.env.get('SUPABASE_ANON_KEY')||'';
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',pepper=Deno.env.get('LUO_BOT_CREDENTIAL_PEPPER')||'';
 if(!url||!publishable||!serviceKey||pepper.length<32)return reply(503,{error:'Bot service not configured.'});
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
 const client=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
 const username=canonicalBotUsername(body.username);
 if(action==='apply'||action==='issue_password'){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return reply(401,{error:'Sign into your human account first.'});
  const identified=await client.auth.getUser(token);
  const owner=identified.data?.user;
  if(identified.error||!owner?.id)return reply(401,{error:'Human owner session invalid.'});
  if(owner.app_metadata?.luo_account_type==='bot')return reply(403,{error:'Bots cannot own other bots.'});
  if(action==='apply'){
   if(!username)return reply(400,{error:'Choose a username beginning with bot_.'});
   const result=await admin.rpc('request_luo_bot_account',{p_owner_id:owner.id,p_username:username});
   if(result.error)return reply(503,{error:'Bot registration currently unavailable.'});
   if(!result.data)return reply(409,{error:'Bot username unavailable or application limit reached.'});
   return reply(200,{ok:true,bot_id:result.data,status:'pending_payment',message:'Bot application saved. No bot access until payment verification and safety approval.'});
  }
  const botId=String(body.bot_id||''),currentPassword=String(body.current_password||'');
  if(!uuid.test(botId)||currentPassword.length<8||currentPassword.length>128)return reply(400,{error:'Bot ID and current account password are required.'});
  // Recheck current human password before issuing a one-time bot credential.
  if(!owner.email)return reply(401,{error:'Human owner session invalid.'});
  const proof=await client.auth.signInWithPassword({email:owner.email,password:currentPassword});
  if(proof.error||proof.data?.user?.id!==owner.id)return reply(401,{error:'Current password not accepted.'});
  const secret=strongPassword();
  const secretDigest=await hmac(pepper,'luo-bot-v1:'+botId+':'+secret);
  const armed=await admin.rpc('activate_luo_bot_credential',{p_owner_id:owner.id,p_bot_id:botId,p_secret_digest:secretDigest});
  if(armed.error)return reply(503,{error:'Bot credential service temporarily unavailable.'});
  if(armed.data!==true)return reply(403,{error:'Bot must have verified payment, approval and permissions before activation.'});
  return reply(200,{ok:true,password:secret,message:'Store this bot password securely. It will not be shown again.'});
 }
 // Bot credentials are NOT a human JWT. Never forward them to PostgREST.
 if(!username)return reply(401,{error:'Invalid bot credentials.'});
 const password=String(body.password||'');
 if(!/^luob_[A-Za-z0-9_-]{43}$/.test(password))return reply(401,{error:'Invalid bot credentials.'});
 const fetched=await admin.rpc('get_luo_bot_gateway_credential',{p_username:username});
 if(fetched.error)return reply(503,{error:'Bot credentials temporarily unavailable.'});
 const record=Array.isArray(fetched.data)?fetched.data[0]:fetched.data;
 const botId=String(record?.bot_id||'');
 const secretDigest=String(record?.secret_digest||'');
 const received=await hmac(pepper,'luo-bot-v1:'+botId+':'+password);
 if(!uuid.test(botId)||!constantTimeHexEq(received,secretDigest)){
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||'unknown';
  const usernameDigest=await hmac(pepper,'failed-bot-user:'+username);
  const ipDigest=await hmac(pepper,'failed-bot-ip:'+ip);
  const limiter=await admin.rpc('consume_luo_bot_login_limit',{p_username_digest:usernameDigest,p_ip_digest:ipDigest});
  if(limiter.error)return reply(503,{error:'Bot login protection unavailable.'});
  if(limiter.data!==true)return reply(429,{error:'Too many bot authentication attempts.'});
  return reply(401,{error:'Invalid bot credentials.'});
 }
 if(action==='bot_auth')return reply(200,{ok:true,bot_id:botId,account_type:'automated_agent',note:'No Supabase human session is issued.'});
 const requestId=String(body.request_id||''),humanId=String(body.human_id||'');
 const conversationId=String(body.conversation_id||'');
 if(!uuid.test(requestId)||!uuid.test(humanId)||!uuid.test(conversationId))
  return reply(400,{error:'Request and authorized private conversation IDs required.'});
 if(action!=='read_assigned_thread')return reply(403,{error:'Action not implemented.'});
 const allowed=await admin.rpc('reserve_luo_bot_action',{
  p_bot_id:botId,p_action:'read_assigned_thread',p_request_id:requestId,
  p_human_id:humanId,p_conversation_id:conversationId
 });
 if(allowed.error)return reply(503,{error:'Bot authorization currently unavailable.'});
 if(allowed.data!==true)return reply(403,{error:'Consent, paid permission or rate limit missing.'});
 // Minimum necessary textual context. No media, contacts or other threads.
 const messages=await admin.from('chat_messages')
  .select('id,sender_id,body,created_at,message_type')
  .eq('conversation_id',conversationId)
  .eq('message_type','text')
  .order('created_at',{ascending:false}).limit(20);
 if(messages.error)return reply(503,{error:'Conversation unavailable.'});
 return reply(200,{ok:true,account_type:'automated_agent',
  messages:(messages.data||[]).map((m:any)=>({
   id:m.id,sender_id:m.sender_id,created_at:m.created_at,
   body:String(m.body||'').slice(0,4000)
  }))
 });
});
