import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {webcrypto} from 'node:crypto';

const shared=(await transform((await readFile('supabase/functions/_shared/http.ts','utf8')).replaceAll('export ',''),{loader:'ts',target:'es2022'})).code;
const auth=(await transform((await readFile('supabase/functions/luo-auth-compat/index.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',target:'es2022'})).code;
const fixtureId='11111111-1111-4111-8111-111111111111';
function harness({found=true,limit=true,backendFail=false,wrongPassword=false}={}){
 let handler;const calls=[];
 const db={
  rpc:async(name,args)=>{calls.push({kind:'limit',name,args});return{data:limit,error:null}},
  from(table){const query={select(){return this},eq(key,value){calls.push({kind:'lookup',table,key,value});return this},maybeSingle:async()=>({data:found?{id:fixtureId}:null,error:backendFail?{message:'database unavailable'}:null})};return query},
  auth:{admin:{getUserById:async id=>{calls.push({kind:'admin',id});return{data:{user:{id,email:'private-legacy@example.invalid'}},error:null}}},
   signInWithPassword:async credentials=>{calls.push({kind:'signin',credentials});return wrongPassword?{data:{session:null},error:{status:400,message:'Invalid login credentials'}}:{data:{session:{access_token:'access_fixture',refresh_token:'refresh_fixture'}},error:null}}
  }
 };
 vm.runInNewContext(shared+'\n'+auth,{createClient:()=>db,Deno:{env:{get:()=> 'testservicekey1234567890'},serve:f=>handler=f},Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,fetch,Date});
 const request=(body,origin='https://luo-chat-luokai25.vercel.app')=>new Request('https://edge.example.invalid',{method:'POST',headers:{origin,'content-type':'application/json','x-real-ip':'192.0.2.4'},body:JSON.stringify({action:'signin_username',username:'friend_007',password:'strong-passphrase',...body})});
 return {handler,calls,request};
}
test('username signin resolves auth identifier only on trusted server and returns token pair',async()=>{
 const h=harness(),response=await h.handler(h.request({}));
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.access_token,'access_fixture');
 assert.equal(body.refresh_token,'refresh_fixture');
 assert.doesNotMatch(JSON.stringify(body),/private-legacy@example.invalid/);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(h.calls[0].kind,'limit');
 assert.equal(h.calls[0].args.action_name,'signin');
 assert.match(h.calls[0].args.email_digest,/^[a-f0-9]{64}$/);
 assert.equal(h.calls[0].args.window_minutes,15);
 assert.equal(h.calls.find(c=>c.kind==='lookup').value,'friend_007');
 assert.equal(h.calls.find(c=>c.kind==='signin').credentials.email,'private-legacy@example.invalid');
});
test('unknown username and wrong password produce identical generic 401 without identifier exposure',async()=>{
 const results=[];
 for(const flags of [{found:false},{wrongPassword:true}]){
  const h=harness(flags),response=await h.handler(h.request({}));
  results.push({status:response.status,body:await response.json()});
 }
 assert.deepEqual(results[0],results[1]);
 assert.deepEqual(results[0],{status:401,body:{error:'Invalid username or password.'}});
});
test('failing closed on unavailable abuse protection or profile lookup',async()=>{
 for(const flags of [{limit:false},{backendFail:true}]){
  const h=harness(flags),response=await h.handler(h.request({}));
  assert.ok([429,503].includes(response.status));
  assert.equal(h.calls.some(x=>x.kind==='signin'),false);
 }
});
test('invalid username and untrusted origins cannot trigger credentials or lookup',async()=>{
 const h=harness();
 const malformed=await h.handler(h.request({username:'evil@example.org'}));
 assert.equal(malformed.status,400);
 const disallowed=await h.handler(h.request({},'https://malicious.invalid'));
 assert.equal(disallowed.status,403);
 assert.equal(h.calls.length,0);
});
test('username login does not call admin functions if attack rate threshold exceeded',async()=>{
 const h=harness({limit:false}),response=await h.handler(h.request({}));
 assert.equal(response.status,429);
 assert.equal(response.headers.get('Retry-After'),'900');
 assert.equal(h.calls.length,1);
});

test('compatibility endpoint keeps legacy email signup, reset and resend while adding username login',async()=>{const file=await readFile('supabase/functions/luo-auth-compat/index.ts','utf8');assert.match(file,/signin_username/);assert.match(file,/action==='signup'/);assert.match(file,/action==='reset'/);assert.match(file,/\['signup','reset','resend'\]\.includes\(action\)/);assert.match(file,/signInWithPassword/);});
