// One-time no-charge launch check against the real production Auth/database.
// Never creates checkout, subscription, paid entitlement or reusable credential.
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createAgentVerificationHandler} from '../src/server/agent-verification.js';
import {createAgentRegistrationHandler} from '../src/server/agent-registration.js';
import {createAgentLoginHandler} from '../src/server/agent-login.js';
import {agentRuntime} from '../src/server/agent-environment.js';
const env=process.env,runtime=agentRuntime(env);
if(env.VERCEL_ENV!=='production'||runtime?.mode!=='live')throw Error('LIVE_SMOKE_REQUIRES_CONFIGURED_PRODUCTION');
const username='launch_'+randomBytes(6).toString('hex'),password=randomBytes(32).toString('base64url');
// Give each isolated production probe a fresh TEST-NET source address so the
// probe cannot exhaust its own per-network quota across repeated deployments.
const probeIp='198.51.100.'+(1+(randomBytes(1)[0]%254));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const db=createClient(runtime.url,runtime.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
let createdId=null;
const factory=(url,key,options)=>{
 const client=createClient(url,key,options);
 if(key===runtime.serviceKey){
  const create=client.auth.admin.createUser.bind(client.auth.admin);
  client.auth.admin.createUser=async(input)=>{const result=await create({...input,app_metadata:{...input.app_metadata,luo_launch_probe:true}});if(result.data?.user?.id)createdId=result.data.user.id;if(result.error)console.error('LUO_AGENT_LAUNCH_AUTH_ERROR',JSON.stringify({status:result.error.status,code:result.error.code}));return result};
  const rpc=client.rpc.bind(client);client.rpc=async(name,args)=>{const result=await rpc(name,args);if(result.error)console.error('LUO_AGENT_LAUNCH_DB_ERROR',JSON.stringify({operation:name,code:result.error.code}));return result};
 }
 return client;
};
async function invoke(handler,body){
 const out={statusCode:0,setHeader(){},status(v){this.statusCode=v;return this},json(v){this.body=v;return this}};
 await handler({method:'POST',body,headers:{'content-type':'application/json',host:'luo-chat-luokai25.vercel.app',origin:'https://luo-chat-luokai25.vercel.app','x-vercel-forwarded-for':probeIp},socket:{remoteAddress:probeIp}},out);
 return out;
}
try{
 const start=await invoke(createAgentVerificationHandler({mode:'start',env,clientFactory:factory}),{username,public_key:publicKey.export({format:'jwk'}).x});
 if(start.statusCode!==201)throw Error('SMOKE_KEY_START_'+start.body?.error?.code);
 const finish=await invoke(createAgentVerificationHandler({mode:'finish',env,clientFactory:factory}),{id:start.body.verification_id,signature:sign(null,Buffer.from(start.body.challenge),privateKey).toString('base64url')});
 if(finish.statusCode!==200)throw Error('SMOKE_KEY_FINISH_'+finish.body?.error?.code);
 const registered=await invoke(createAgentRegistrationHandler({env,clientFactory:factory}),{username,password,plan:'starter',verification_id:start.body.verification_id});
 if(registered.statusCode!==201||registered.body.agent.state!=='pending'||registered.body.api_credential_issued!==false)throw Error('SMOKE_PENDING_REGISTRATION_'+registered.body?.error?.code);
 const isolated=await db.from('profiles').select('id').eq('id',createdId);
 if(isolated.error||isolated.data?.length!==0)throw Error('SMOKE_AGENT_HUMAN_PROFILE_ISOLATION_FAILED');
 const login=await invoke(createAgentLoginHandler({env,clientFactory:factory}),{username,password});
 if(login.statusCode!==402||login.body?.error?.code!=='PAYMENT_REQUIRED')throw Error('SMOKE_UNPAID_ACCESS_DENIAL_'+login.body?.error?.code);
 console.log('LUO_AGENT_LAUNCH_SMOKE',JSON.stringify({ed25519_proof:true,pending_registration:true,real_password_auth:true,human_profile_isolated:true,unpaid_login_denied:true,payment_created:false,paid_access_granted:false}));
}finally{
 if(createdId){const released=await db.rpc('luo_agent_discard_launch_probe',{p_auth_user:createdId});if(released.error)throw Error('SMOKE_TEST_IDENTITY_RELEASE_FAILED');const removed=await db.auth.admin.deleteUser(createdId);if(removed.error&&removed.error.status!==404)throw Error('SMOKE_TEST_IDENTITY_CLEANUP_FAILED');console.log('LUO_AGENT_LAUNCH_SMOKE_CLEANUP',JSON.stringify({test_identity_deleted:true}));}
}
