import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const pepper='server-only-example-bot-credential-pepper-32bytes';
const botId='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const humanId='33333333-3333-4333-8333-333333333333';
const roomId='44444444-4444-4444-8444-444444444444';
const requestId='55555555-5555-4555-8555-555555555555';
const secret='luob_'+Buffer.alloc(32,5).toString('base64url');
async function signedSecret(){
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode('luo-bot-v1:'+botId+':'+secret))).toString('hex');
}
const http=(await transform((await readFile('supabase/functions/_shared/http.ts','utf8')).replaceAll('export ',''),{loader:'ts',target:'es2022'})).code;
const policy=(await transform((await readFile('supabase/functions/_shared/bot-policy.ts','utf8')).replaceAll('export ',''),{loader:'ts',target:'es2022'})).code;
const gateway=(await transform((await readFile('supabase/functions/luo-bot-gateway/index.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',target:'es2022'})).code;
async function harness({paid=true,consent=true,validOwner=true,validOwnerPassword=true,failRate=false}={}){
 let handler;const calls=[];const expectedDigest=await signedSecret();
 const db={
  auth:{
   getUser:async token=>({data:{user:validOwner?{id:ownerId,email:'internal@example.invalid',app_metadata:{}}:null},error:validOwner?null:{message:'not authenticated'}}),
   signInWithPassword:async()=>validOwnerPassword?{data:{user:{id:ownerId}},error:null}:{data:{user:null},error:{status:400}}
  },
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='request_luo_bot_account')return {data:botId,error:null};
   if(name==='activate_luo_bot_credential')return {data:paid,error:null};
   if(name==='get_luo_bot_gateway_credential')return {data:paid?[{bot_id:botId,secret_digest:expectedDigest}]:[],error:null};
   if(name==='consume_luo_bot_login_limit')return {data:!failRate,error:null};
   if(name==='reserve_luo_bot_action')return {data:consent,error:null};
   return {data:false,error:null};
  },
  from:(table)=>{
   assert.equal(table,'chat_messages');
   const q={select(){return q},eq(){return q},order(){return q},limit:async()=>({data:[{id:'22222222-2222-4222-8222-222222222222',sender_id:humanId,body:'Private consented message',created_at:'2026-10-23T12:00:00Z'}],error:null})};
   return q;
  }
 };
 let configured=true;
 const Deno={env:{get:k=>configured?({
  SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',
  SUPABASE_SERVICE_ROLE_KEY:'server-service-role',
  LUO_BOT_CREDENTIAL_PEPPER:pepper
 }[k]):undefined},serve:f=>handler=f};
 vm.runInNewContext(http+'\n'+policy+'\n'+gateway,{
  Deno,createClient:()=>db,Response,Request,URL,TextEncoder,TextDecoder,
  Uint8Array,AbortSignal,crypto:webcrypto,btoa,setTimeout,clearTimeout,fetch,
  Date,Array,Set,Object
 });
 const make=(action,args={},auth=null)=>new Request('https://edge.example.invalid',{method:'POST',
  headers:{'content-type':'application/json',origin:'https://luo-chat-luokai25.vercel.app',
   ...(auth?{authorization:'Bearer '+auth}:{})},
  body:JSON.stringify({action,...args})
 });
 return {handler,calls,make,disable:()=>{configured=false}};
}
test('bot application is owned by authenticated human and remains unpaid',async()=>{
 const h=await harness();
 const r=await h.handler(h.make('apply',{username:'bot_helper'},'human-jwt'));
 assert.equal(r.status,200);
 const p=await r.json();
 assert.equal(p.status,'pending_payment');
 assert.equal(p.bot_id,botId);
 assert.equal(p.password,undefined);
 const call=h.calls.find(x=>x.name==='request_luo_bot_account');
 assert.equal(call.args.p_owner_id,ownerId);
 assert.equal(call.args.p_username,'bot_helper');
});
test('bots cannot create other bots, and human applicants cannot bypass authentication',async()=>{
 const h=await harness({validOwner:false});
 const r=await h.handler(h.make('apply',{username:'bot_helper'},'fake-jwt'));
 assert.equal(r.status,401);
 assert.equal(h.calls.length,0);
 const none=await h.handler(h.make('apply',{username:'bot_helper'}));
 assert.equal(none.status,401);
});
test('issued bot password requires paid entitlement, moderator approval and human password proof',async()=>{
 const h=await harness({paid:false});
 const data={bot_id:botId,current_password:'the-current-human-password'};
 const response=await h.handler(h.make('issue_password',data,'human-jwt'));
 assert.equal(response.status,403);
 assert.doesNotMatch(await response.text(),/luob_/);
 const wrong=await harness({validOwnerPassword:false});
 const r=await wrong.handler(wrong.make('issue_password',data,'human-jwt'));
 assert.equal(r.status,401);
 assert.equal(wrong.calls.length,0);
});
test('bot secret authentication issues no Supabase JWT or human role',async()=>{
 const h=await harness(),r=await h.handler(h.make('bot_auth',{username:'bot_helper',password:secret}));
 assert.equal(r.status,200);
 const p=await r.json();
 assert.equal(p.account_type,'automated_agent');
 assert.equal(p.bot_id,botId);
 assert.ok(!Object.hasOwn(p,'access_token'));
 assert.ok(!Object.hasOwn(p,'refresh_token'));
});
test('bot cannot use wrong secret; authentication is separately rate-limited',async()=>{
 const h=await harness({failRate:true});
 const invalid='luob_'+Buffer.alloc(32,6).toString('base64url');
 const r=await h.handler(h.make('bot_auth',{username:'bot_helper',password:invalid}));
 assert.equal(r.status,429);
 assert.equal(h.calls.some(x=>x.name==='consume_luo_bot_login_limit'),true);
 assert.equal(h.calls.some(x=>x.name==='reserve_luo_bot_action'),false);
});
test('bot reads only granted 1:1 thread with atomic quota authorization',async()=>{
 const h=await harness();
 const args={username:'bot_helper',password:secret,human_id:humanId,conversation_id:roomId,request_id:requestId};
 const r=await h.handler(h.make('read_assigned_thread',args));
 assert.equal(r.status,200);
 const p=await r.json();
 assert.equal(p.messages[0].body,'Private consented message');
 const receipt=h.calls.find(x=>x.name==='reserve_luo_bot_action');
 assert.equal(receipt.args.p_action,'read_assigned_thread');
 assert.equal(receipt.args.p_human_id,humanId);
 assert.equal(receipt.args.p_conversation_id,roomId);
 const blocked=await harness({consent:false});
 const d=await blocked.handler(blocked.make('read_assigned_thread',args));
 assert.equal(d.status,403);
 assert.equal(d.body,undefined);
});
test('unimplemented sending, scraping, cold DMs and calls are not even recognized',async()=>{
 const h=await harness();
 for(const action of ['send_reply','search_all_users','send_cold_dm','initiate_call','delete_account']){
  const r=await h.handler(h.make(action,{username:'bot_helper',password:secret}));
  assert.equal(r.status,400,action);
 }
 assert.equal(h.calls.length,0);
});
test('bot gateway remains unavailable until server secrets are configured',async()=>{
 const h=await harness();h.disable();
 const r=await h.handler(h.make('bot_auth',{username:'bot_helper',password:secret}));
 assert.equal(r.status,503);
 assert.equal(h.calls.length,0);
});
