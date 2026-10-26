import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAgentCheckoutHandler} from '../src/server/agent-billing.js';
import {createAgentCheckoutStatusHandler} from '../src/server/agent-checkout-status.js';
const env={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/agent-autonomous-onboarding-20261026',
 LUO_AGENT_BILLING_ENABLED:'true',
 LUO_AGENT_STAGING_URL:'https://itecovbwilcrvjqkdoyd.supabase.co',
 LUO_AGENT_STAGING_SERVICE_ROLE_KEY:'fake_service_credential_long_enough_for_testing',
 LUO_AGENT_STAGING_PUBLISHABLE_KEY:'fake_public_credential_long_enough_for_testing',
 LUO_AGENT_SIGNUP_HASH_KEY:'a'.repeat(48),
 LUO_STRIPE_SECRET_KEY:'sk_test_dummy_secret',
 LUO_STRIPE_PRICE_STANDARD:'price_123456789AAAA',
 LUO_STRIPE_PRICE_PRO:'price_123456789BBBB',
 LUO_STRIPE_PRICE_MAXIMUM:'price_123456789CCCC',
 VERCEL:'1'
};
const INTENT='77777777-7777-4777-8777-777777777777', CLAIM='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const owner='11111111-1111-4111-8111-111111111111';
const url='https://checkout.stripe.com/c/pay/cs_test_dummy';
const req=(status=false)=>({method:'POST',headers:{'content-type':'application/json',
 host:'luo-chat-luokai25-abcdef12-luokai25s-projects.vercel.app','x-vercel-forwarded-for':'192.0.2.20'},
 body:status?{username:'test_agent',password:'password secure enough!'}:
 {username:'test_agent',password:'password secure enough!',provider:'stripe',plan:'starter'}});
const res=()=>({statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
function model(){
 let claimed=false,ref=null,processorCreates=0,attach=0;const names=[];
 const svc={rpc:async(name,args)=>{
  names.push(name);
  if(name==='luo_agent_reserve_login')return {data:true};
  if(name==='luo_agent_reserve_checkout')return {data:{intent_id:INTENT,agent_id:owner,
   plan:'starter',provider:'stripe',promo:false,regular_cents:1200,first_invoice_cents:1200,existing_reference:ref}};
  if(name==='luo_agent_claim_checkout_once'){
   if(ref)return {data:{action:'reuse',reference:ref}};
   if(claimed)return {data:{action:'locked',state:'creation_or_reconciliation_pending'}};
   claimed=true;return {data:{action:'create',claim_token:CLAIM}};
  }
  if(name==='luo_agent_bind_checkout_once'){
   assert.equal(args.p_claim,CLAIM);
   if(ref&&ref!==args.p_reference)return {data:false};
   ref=args.p_reference;attach++;return {data:true};
  }
  if(name==='luo_agent_checkout_state')return{data:{state:ref?'awaiting_payment':claimed?'creation_or_reconciliation_pending':'not_started',
   intent_id:INTENT,plan:'starter',provider:'stripe',checkout_reference:ref}};
  throw Error('Unexpected RPC '+name);
 }};
 const auth={auth:{signInWithPassword:async()=>({data:{user:{id:owner}}})}};
 const factory=(_url,key)=>key===env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY?svc:auth;
 const fetcher=async(requestUrl,init)=>{
  if(init?.method==='POST'){
   processorCreates++;return {ok:true,json:async()=>({id:'cs_test_abcdefgh1234',url})};
  }
  return {ok:true,json:async()=>({id:'cs_test_abcdefgh1234',
    client_reference_id:INTENT,status:'open',url})};
 };
 return {factory,fetcher,names,get creates(){return processorCreates},get binds(){return attach}};
}
test('two simultaneous paid checkout requests generate exactly one processor session',async()=>{
 const db=model(),handler=createAgentCheckoutHandler({env,clientFactory:db.factory,fetcher:db.fetcher,
 now:()=>Date.parse('2026-10-26T20:00:00Z')});
 const a=res(),b=res();await Promise.all([handler(req(),a),handler(req(),b)]);
 assert.equal(db.creates,1);assert.equal(db.binds,1);
 assert.deepEqual([a.statusCode,b.statusCode].sort(),[201,202]);
 assert.equal(a.body.checkout_locked,true);assert.equal(b.body.checkout_locked,true);
});
test('later checkout requests reuse the first already-created session with no second POST',async()=>{
 const db=model(),handler=createAgentCheckoutHandler({env,clientFactory:db.factory,fetcher:db.fetcher});
 const a=res(),b=res();await handler(req(),a);await handler(req(),b);
 assert.equal(a.statusCode,201);assert.equal(b.statusCode,200);
 assert.equal(a.body.checkout_url,b.body.checkout_url);
 assert.equal(db.creates,1);assert.equal(db.binds,1);
});
test('unknown processor outcome stays locked and cannot be retried with the same or a new key',async()=>{
 const db=model();let calls=0;
 const handler=createAgentCheckoutHandler({env,clientFactory:db.factory,logger:{error(){}},
  fetcher:async()=>{calls++;throw Error('NETWORK_DROPPED_AFTER_REMOTE_CREATE')}});
 const first=res(),second=res();
 await handler(req(),first);await handler(req(),second);
 assert.equal(first.statusCode,503);assert.equal(second.statusCode,202);
 assert.equal(calls,1);
 assert.equal(db.creates,0);
});
test('status route verifies password and never creates payment; existing link can be resumed',async()=>{
 const db=model(),handler=createAgentCheckoutHandler({env,clientFactory:db.factory,fetcher:db.fetcher});
 await handler(req(),res());
 const status=createAgentCheckoutStatusHandler({env,clientFactory:db.factory,fetcher:db.fetcher,logger:{error(){}}});
 const out=res();await status(req(true),out);
 assert.equal(out.statusCode,200);assert.equal(out.body.checkout_locked,true);
 assert.equal(out.body.state,'awaiting_payment');assert.equal(out.body.checkout_url,url);
 assert.equal(db.creates,1);
});
test('checkout SQL removes expired intent resets and requires one create token',async()=>{
 const sql=await readFile('supabase/migrations/20261026191655_agent_checkout_create_once_lock.sql','utf8');
 assert.match(sql,/creation_claimed_at/);
 assert.match(sql,/luo_agent_claim_checkout_once/);
 assert.match(sql,/luo_agent_bind_checkout_once/);
 assert.match(sql,/creation_claim_token=p_claim/);
 assert.match(sql,/revoke all on function public\.luo_agent_attach_checkout/);
 assert.doesNotMatch(sql,/set id=gen_random_uuid\(\)/);
});
test('payment button locks immediately and persists in tab session storage',async()=>{
 const source=await readFile('public/luo-agent-checkout.js','utf8');
 assert.match(source,/busy=true;save\(\{key:key\(\),state:'submitted'\}\)/);
 assert.match(source,/pay\.disabled=!available\|\|busy\|\|locked/);
 assert.match(source,/sessionStorage/);
 assert.match(source,/billing\/status/);
});
