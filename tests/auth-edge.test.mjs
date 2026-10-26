import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';import {webcrypto} from 'node:crypto';
const shared=(await transform((await readFile('supabase/functions/_shared/http.ts','utf8')).replaceAll('export ',''),{loader:'ts',target:'es2022'})).code;
const auth=(await transform((await readFile('supabase/functions/luo-auth/index.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',target:'es2022'})).code;
function setup(allowed=true,authError=null){let handler;const calls=[];const send=async(name,email,args)=>{calls.push([name,email,args]);if(authError==='throw')throw Error('synthetic private provider detail');return{error:authError}};const db={rpc:async(name,args)=>{calls.push([name,args]);return{data:allowed}},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})}),auth:{resetPasswordForEmail:(email,args)=>send('reset',email,args),resend:args=>send('resend',args.email,args),signUp:args=>send('signup',args.email,args)}};vm.runInNewContext(shared+'\n'+auth,{createClient:()=>db,Deno:{env:{get:()=> 'fixture'},serve:f=>handler=f},Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto:webcrypto,atob,setTimeout,clearTimeout,fetch});return{handler,calls}};

test('age restrictions fail closed before rate limits or Auth provider signup',async()=>{
 for(const [age_band,status] of [['under13',403],['under12',403],['13-14',503],['15-17',503],['12-17',503],['bogus',400],['',400]]){
  const s=setup(),r=await s.handler(req({email:'minor@example.invalid',action:'signup',username:'minor',password:'test-password',age_band}));
  assert.equal(r.status,status,'age group '+age_band);
  assert.equal(s.calls.length,0,'unexpected backend mutation or rate-limit call');
 }
});
test('guardian-code leftovers cannot bypass currently closed youth registration',async()=>{
 const s=setup(),r=await s.handler(req({
  email:'teen@example.invalid',action:'signup',username:'teen',password:'test-password',
  age_band:'13-14',guardian_approval:'v1.fake'
 }));
 assert.equal(r.status,503);
 assert.equal(s.calls.length,0);
});
test('adult registration includes age band and still passes server validation',async()=>{
 const s=setup(),r=await s.handler(req({email:'adult@example.invalid',action:'signup',username:'adult',password:'test-password',age_band:'18+'}));
 assert.equal(r.status,200);assert.equal(s.calls.find(c=>c[0]==='signup')[2].options.data.registration_age_band,'18+');
});
const req=(body,extra={})=>new Request('https://fixture.invalid',{method:'POST',headers:{'content-type':'application/json',origin:'https://luo-chat-luokai25.vercel.app','x-real-ip':'192.0.2.1',...extra},body:JSON.stringify(body)});
test('auth rejects untrusted origins and oversized bodies before rate-limit RPCs',async()=>{for(const request of [req({email:'test@example.invalid',action:'reset'},{origin:'https://evil.invalid'}),req({data:'x'.repeat(17000)})]){const s=setup();assert.ok([400,403].includes((await s.handler(request)).status));assert.equal(s.calls.length,0)}});
test('auth rate-limit failure returns 429 with retry advice and sends no email',async()=>{const s=setup(false),r=await s.handler(req({email:'test@example.invalid',action:'reset'}));assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'3600');assert.equal(s.calls.length,1);assert.equal(r.headers.get('Cache-Control'),'no-store')});
test('recovery redirects cannot leave the allowlist and email addresses are hashed for quotas',async()=>{const s=setup(),r=await s.handler(req({email:'test@example.invalid',action:'reset',redirect_to:'https://evil.invalid/steal'}));assert.equal(r.status,200);assert.equal(s.calls[0][0],'consume_auth_action_limit');assert.match(s.calls[0][1].email_digest,/^[a-f0-9]{64}$/);assert.equal(s.calls[1][2].redirectTo,'https://luo-chat-luokai25.vercel.app/');});

const deletion=(await transform((await readFile('supabase/functions/luo-delete-account/index.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',target:'es2022'})).code;
test('deletion rejects malformed and oversized JSON without password checks or mutations',async()=>{let handler,checks=0;const db={auth:{getUser:async()=>({data:{user:{id:'fixture',email:'test@example.invalid'}}}),signInWithPassword:async()=>{checks++;throw Error('Unexpected reauthentication')}}};vm.runInNewContext(shared+'\n'+deletion,{createClient:()=>db,Deno:{env:{get:()=> 'fixture'},serve:f=>handler=f},Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,fetch});for(const body of ['not json','{"data":"'+'x'.repeat(17000)+'"}']){const request=new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},body});assert.equal((await handler(request)).status,400);}assert.equal(checks,0);});

for(const action of ['signup','reset','resend']){
 test(action+' propagates provider throttling without leaking details',async()=>{
  const s=setup(true,{status:429,message:'private provider details'}),r=await s.handler(req({email:'test@example.invalid',action,username:'testuser',password:'fixture-password',age_band:'18+'}));
  assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'60');assert.equal(s.calls.filter(x=>x[0]===action).length,1);assert.doesNotMatch(await r.text(),/private provider details/);
 });
 test(action+' reports transport and SMTP setup failures instead of success',async()=>{
  for(const error of [{status:0},{status:503},{status:403,code:'email_address_not_authorized'},'throw']){
   const s=setup(true,error),r=await s.handler(req({email:'test@example.invalid',action,username:'testuser',password:'fixture-password',age_band:'18+'}));
   assert.equal(r.status,503);assert.equal(s.calls.filter(x=>x[0]===action).length,1);assert.doesNotMatch(await r.text(),/synthetic private provider detail/);
  }
 });
}
test('unknown recovery and resend accounts retain the same generic success response',async()=>{
 for(const action of ['reset','resend']){
  const s=setup(true,{status:400,code:'user_not_found'}),r=await s.handler(req({email:'test@example.invalid',action}));assert.equal(r.status,200);assert.equal((await r.json()).message,'If eligible, check your email.');
 }
});
