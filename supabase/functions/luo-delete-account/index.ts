import {timedFetch,readRequestJSON} from '../_shared/http.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
Deno.serve(async req=>{
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'Method not allowed.'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token||token.length>8192||/\s/.test(token))return reply(401,{error:'Sign in required.'});
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:timedFetch}});
  const {data,error}=await client.auth.getUser(token);if(error||!data.user?.email)return reply(401,{error:'Sign in required.'});
  let body;try{body=await readRequestJSON(req)}catch{return reply(400,{error:'Send a JSON object up to 16 KiB.'})}if(body.confirmation!=='DELETE MY ACCOUNT'||typeof body.password!=='string'||body.password.length<8||body.password.length>128)return reply(400,{error:'Password and explicit confirmation required.'});
  const check=await client.auth.signInWithPassword({email:data.user.email,password:body.password});if(check.error||check.data.user?.id!==data.user.id)return reply(403,{error:'Password confirmation failed.'});
  // Reauthentication creates a temporary session; revoke it before proceeding.
  await client.auth.signOut({scope:'local'});
  const eligible=await admin.rpc('check_chat_account_deletion',{target_user_id:data.user.id});if(eligible.error)return reply(409,{error:eligible.error.message});
  const files=await admin.rpc('chat_account_storage_paths',{target_user_id:data.user.id});if(files.error)return reply(500,{error:'Could not prepare media cleanup.'});
  for(const bucket of ['chat-media','avatars','luo-stories','luo-vault']){const paths=(files.data||[]).filter((f:any)=>f.bucket_id===bucket).map((f:any)=>f.object_path);for(let i=0;i<paths.length;i+=100){const removed=await admin.storage.from(bucket).remove(paths.slice(i,i+100));if(removed.error)return reply(503,{error:'Media cleanup could not finish. Your account remains active; retry deletion.'})}}
  const deleted=await admin.auth.admin.deleteUser(data.user.id);if(deleted.error)return reply(500,{error:'Account deletion did not finish. Please retry.'});
  return reply(200,{ok:true});
 }catch{return reply(500,{error:'Deletion could not finish. Your account may remain active; sign in to check.'})}
});
