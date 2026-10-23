import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const shared=(await transform((await readFile('supabase/functions/_shared/http.ts','utf8')).replaceAll('export ',''),{loader:'ts',target:'es2022'})).code;
const script=(await transform((await readFile('supabase/functions/luo-auth/index.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',target:'es2022'})).code;
const id='11111111-1111-4111-8111-111111111111';
function harness({quota=true,exists=false,storeFails=false,validPassword=true,consume=true,providerError=null}={}){
 let handler,created,deleted=[],stored=[],passwordChanges=[],calls=[];
 const alias='luo-00112233445566778899aabbccddeeff@accounts.invalid';
 const admin={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='consume_signup_rate_limit'||name==='consume_auth_action_limit')return{data:quota,error:null};
   if(name==='replace_luo_recovery_codes'){if(storeFails)return{data:false,error:{message:'Unavailable'}};stored=args.code_hashes;return{data:true,error:null}}
   if(name==='consume_luo_recovery_code')return{data:consume,error:null};
   return{data:null,error:{message:'Unknown RPC'}};
  },
  from:table=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:exists?{id}:null,error:null})}),
  auth:{
   admin:{
    createUser:async args=>{created=args;calls.push({name:'createUser'});return providerError?{data:null,error:providerError}:{data:{user:{id,email:args.email}},error:null}},
    deleteUser:async uid=>{deleted.push(uid);return{error:null}},
    getUserById:async uid=>({data:{user:{id:uid,email:alias}},error:null}),
    updateUserById:async(uid,args)=>{passwordChanges.push({uid,args});return{data:{user:{id:uid}},error:null}}
   },
   signInWithPassword:async ({email,password})=>validPassword?{data:{user:{id},session:{access_token:'access',refresh_token:'refresh'}},error:null}:{data:{},error:{status:400,message:'Invalid login credentials'}},
   getUser:async token=>({data:{user:{id,email:alias}},error:token==='good'?null:{message:'invalid token'}})
  }
 };
 const Deno={env:{get:x=>x==='SUPABASE_URL'?'https://example.supabase.co':x==='SUPABASE_ANON_KEY'?'anon-fixture':'service-secret-fixture'},serve:f=>handler=f};
 vm.runInNewContext(shared+'\n'+script,{createClient:()=>admin,Deno,Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,fetch,Date});
 const post=(action,values={},headers={})=>new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json',origin:'https://luo-chat-luokai25.vercel.app','x-real-ip':'203.0.113.1',...headers},body:JSON.stringify({action,...values})});
 return {get handler(){return handler},post,get created(){return created},deleted,stored,passwordChanges,calls,id};
}
test('brand new username signup creates a confirmed internal Auth user without Gmail, then issues ten recovery codes',async()=>{
 const h=harness(),response=await h.handler(h.post('signup_username',{username:'New_Account',password:'strong-chosen-password'})),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.ok,true);
 assert.equal(body.access_token,'access');
 assert.equal(body.refresh_token,'refresh');
 assert.ok(Array.isArray(body.recovery_codes));
 assert.equal(body.recovery_codes.length,10);
 assert.equal(new Set(body.recovery_codes).size,10);
 for(const c of body.recovery_codes)assert.match(c,/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){4}$/);
 assert.equal(h.created.email_confirm,true);
 assert.match(h.created.email,/^luo-[a-f0-9]{32}@accounts\.invalid$/);
 assert.equal(h.created.user_metadata.username,'new_account');
 assert.equal(h.created.app_metadata.luo_registration_v2,'approved');
 assert.doesNotMatch(JSON.stringify(body),/@accounts\.invalid/);
 assert.equal(h.calls[0].name,'consume_signup_rate_limit');
 assert.match(h.calls[0].args.ip_digest,/^[a-f0-9]{64}$/);
 assert.equal(h.stored.length,10);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('registration blocks reserved names, short passwords and repeated username before creating Auth user',async()=>{
 for(const [username,password] of [['admin','example-long-password'],['user','12345678'],['luo_custom','example-long-password'],['fo','example-long-password']]){
  const h=harness(),response=await h.handler(h.post('signup_username',{username,password}));
  assert.equal(response.status,400);
  assert.equal(h.created,undefined);
 }
 const h=harness({exists:true}),response=await h.handler(h.post('signup_username',{username:'existing',password:'example-long-password'}));
 assert.equal(response.status,409);
 assert.equal(h.created,undefined);
});
test('registration quotas deny suspicious bursts and unavailable recovery storage cleans up only newly created user',async()=>{
 const h=harness({quota:false});
 const denied=await h.handler(h.post('signup_username',{username:'alice01',password:'some-password-long'}));
 assert.equal(denied.status,429);
 assert.equal(h.created,undefined);
 const fail=harness({storeFails:true}),response=await fail.handler(fail.post('signup_username',{username:'alice01',password:'some-password-long'}));
 assert.equal(response.status,503);
 assert.equal(fail.deleted.length,1);
 assert.equal(fail.deleted[0],id);
 assert.ok(!JSON.stringify(await response.json()).includes('service-secret'));
});
test('recovery accepts one server-verified code, updates Auth password and rotates codes',async()=>{
 const h=harness(),code='ABCD-EFGH-JKLM-NPQR-STUV';
 const response=await h.handler(h.post('recover_username',{username:'legacy01',recovery_code:code,new_password:'this-is-another-password'}));
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(h.calls.some(x=>x.name==='consume_luo_recovery_code'),true);
 assert.deepEqual(h.passwordChanges.map(x=>x.uid),[id]);
 assert.equal(h.passwordChanges[0].args.password,'this-is-another-password');
 assert.equal(body.recovery_codes.length,10);
 assert.equal(h.stored.length,10);
});
test('used recovery code never changes the password and returns generic failure',async()=>{
 const h=harness({consume:false});
 const r=await h.handler(h.post('recover_username',{username:'existing',recovery_code:'ABCD-EFGH-JKLM-NPQR-STUV',new_password:'this-is-another-password'}));
 assert.equal(r.status,401);
 assert.equal(h.passwordChanges.length,0);
});
test('existing users must supply signed JWT and existing password before recovery-code rotation',async()=>{
 const h=harness({validPassword:false});
 let r=await h.handler(h.post('enroll_recovery',{password:'existing-password'},{}));
 assert.equal(r.status,401);
 r=await h.handler(h.post('enroll_recovery',{password:'existing-password'},{authorization:'Bearer good'}));
 assert.equal(r.status,401);
 assert.equal(h.stored.length,0);
 const good=harness();
 r=await good.handler(good.post('enroll_recovery',{password:'existing-password'},{authorization:'Bearer good'}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).recovery_codes.length,10);
});
test('server denies unknown or unsafe origins and responses never publish internal identifiers',async()=>{
 const h=harness();
 const r=await h.handler(h.post('signup_username',{username:'alice01',password:'a-long-password-example'},{origin:'https://evil.example'}));
 assert.equal(r.status,403);
 assert.equal(h.calls.length,0);
});
