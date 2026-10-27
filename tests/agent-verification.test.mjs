import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createAgentVerificationHandler,proofMessage,verificationRuntime} from '../src/server/agent-verification.js';

const live={
 VERCEL:'1',VERCEL_ENV:'production',LUO_AGENT_VERIFICATION_ENABLED:'true',
 SUPABASE_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'strictly_fake_service_role_for_tests_only_123456789'
};
const uuid='31613b2b-6cc1-49ab-a843-43c4a60a4a9b';
const nonce='A'.repeat(43);
const exp=new Date(Date.now()+600000).toISOString();
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const rawKey=publicKey.export({format:'jwk'}).x;
const req=(body,other={})=>({method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.42'},body,...other});
const response=()=>({statusCode:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}});
function mock(){
 const calls=[],record={id:uuid,username:'autonomous_luo',public_key:rawKey,challenge_nonce:nonce,state:'pending',expires_at:exp};
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='luo_agent_verify_start')return {data:{id:uuid,expires_at:exp},error:null};
  if(name==='luo_agent_verify_attempt')return {data:record,error:null};
  if(name==='luo_agent_verify_complete'){record.state='verified';return {data:{id:uuid,state:'key_verified',verified_until:new Date(Date.now()+86400000).toISOString()},error:null}}
  if(name==='luo_agent_verify_status')return {data:{id:uuid,state:record.state==='verified'?'key_verified':'challenge_pending',membership_active:false,chat_access:false},error:null};
  throw Error('Unexpected RPC')
 }};
 return {calls,record,db};
}
const make=(mode,env,db)=>createAgentVerificationHandler({mode,env,clientFactory:()=>db,logger:{error(){}} ,random:()=>Buffer.from(nonce,'base64url')});
test('production verification is independently gated and does not activate paid agents',async()=>{
 assert.equal(verificationRuntime({}),null);
 const missing={...live};delete missing.LUO_AGENT_VERIFICATION_ENABLED;
 assert.equal(verificationRuntime(missing),null);
 assert.equal(verificationRuntime(live).mode,'production');
 const disabled=response();
 await make('start',missing,mock().db)(req({username:'autonomous_luo',public_key:rawKey}),disabled);
 assert.equal(disabled.statusCode,503);
 const info=response();await make('info',missing,mock().db)({method:'GET',headers:{}},info);
 assert.equal(info.statusCode,200);
 assert.equal(info.body.verification_available,false);
 assert.equal(info.body.payment_activation,'closed');
});
test('agent can obtain a single Ed25519 proof challenge without being signed up or charged',async()=>{
 const m=mock(),res=response();
 await make('start',live,m.db)(req({username:'autonomous_luo',public_key:rawKey}),res);
 assert.equal(res.statusCode,201);
 assert.equal(res.body.verification_id,uuid);
 assert.equal(res.body.challenge,proofMessage({id:uuid,nonce,username:'autonomous_luo'}));
 assert.equal(res.body.chat_access,false);
 assert.deepEqual(m.calls.map(x=>x.name),['luo_agent_verify_start']);
 assert.match(m.calls[0].args.p_network_digest,/^[0-9a-f]{64}$/);
 assert.equal(m.calls[0].args.p_public_key,rawKey);
 assert.ok(!JSON.stringify(res.body).includes(live.SUPABASE_SERVICE_ROLE_KEY));
});
test('signature verified with stored public key; completion does not grant memberships',async()=>{
 const m=mock(),res=response(),text=proofMessage({id:uuid,nonce,username:'autonomous_luo'});
 const signature=sign(null,Buffer.from(text),privateKey).toString('base64url');
 await make('finish',live,m.db)(req({id:uuid,signature}),res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.verification.state,'key_verified');
 assert.equal(res.body.verification.membership_active,false);
 assert.equal(res.body.verification.chat_access,false);
 assert.equal(res.body.verification.payment_activation,'closed');
 assert.deepEqual(m.calls.map(x=>x.name),['luo_agent_verify_attempt','luo_agent_verify_complete']);
 const status=response();await make('status',live,m.db)({method:'GET',headers:{},query:{id:uuid}},status);
 assert.equal(status.statusCode,200);
 assert.equal(status.body.verification.chat_access,false);
});
test('other keys cannot prove ownership, and consumed/expired challenges are rejected',async()=>{
 const other=generateKeyPairSync('ed25519').privateKey;
 const payload=proofMessage({id:uuid,nonce,username:'autonomous_luo'});
 const bad=sign(null,Buffer.from(payload),other).toString('base64url');
 const m=mock(),failed=response();
 await make('finish',live,m.db)(req({id:uuid,signature:bad}),failed);
 assert.equal(failed.statusCode,401);
 assert.deepEqual(m.calls.map(x=>x.name),['luo_agent_verify_attempt']);
 const dead=mock();dead.record.expires_at=new Date(Date.now()-5000).toISOString();
 const expired=response();
 await make('finish',live,dead.db)(req({id:uuid,signature:bad}),expired);
 assert.equal(expired.statusCode,409);
});
test('rejects reserved agent names, oversized bodies, unknown fields and request spoofing',async()=>{
 for(const [input,status] of [
  [{username:'openai',public_key:rawKey},400],
  [{username:'autonomous_luo',public_key:'x'.repeat(43)},400],
  [{username:'autonomous_luo',public_key:rawKey,role:'admin'},400],
  [{username:'autonomous_luo',public_key:rawKey,comment:'x'.repeat(3000)},400]
 ]){
  const out=response();await make('start',live,mock().db)(req(input),out);assert.equal(out.statusCode,status);
 }
 const out=response();await make('start',live,mock().db)(
  req({username:'autonomous_luo',public_key:rawKey},{headers:{'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1,10.0.0.1'}}),out);
 assert.equal(out.statusCode,503);
 const cross=response();await make('start',live,mock().db)(
  req({username:'autonomous_luo',public_key:rawKey},{headers:{'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.42','sec-fetch-site':'cross-site'}}),cross);
 assert.equal(cross.statusCode,403);
});
test('quota failures are explicit and do not write verification approvals',async()=>{
 const m=mock();m.db.rpc=async()=>({data:null,error:{code:'P0001'}});const out=response();
 await make('start',live,m.db)(req({username:'autonomous_luo',public_key:rawKey}),out);
 assert.equal(out.statusCode,429);
 assert.equal(out.headers['Retry-After'],'86400');
});
test('source exposes verification only as a public-key proof and keeps paid routes separately gated',async()=>{
 const {readFile}=await import('node:fs/promises');
 const gateway=await readFile('api/agent-gateway.js','utf8');
 assert.match(gateway,/agents\/verification\/start/);
 assert.match(gateway,/agents\/verification\/finish/);
 const runtime=await readFile('src/server/agent-environment.js','utf8');
 assert.match(runtime,/LUO_AGENT_PRODUCTION_DATABASE_READY/);
 assert.match(runtime,/LUO_AGENT_LIVE_SECRET_ROTATED/);
});
