import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import vm from 'node:vm';
const raw=await readFile('supabase/functions/_shared/bot-policy.ts','utf8');
const code=(await transform(raw,{loader:'ts',format:'cjs',target:'es2022'})).code;
const box={module:{exports:{}},exports:{},Date,Set,Object};
vm.runInNewContext(code,box);
const policy=box.module.exports;
const now=Date.parse('2026-10-23T12:00:00Z');
const uid='11111111-1111-4111-8111-111111111111',botId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const paid={id:botId,tier:'agent_basic',payment_status:'active',moderation_status:'approved',suspended:false,paid_until:'2026-11-23T00:00:00Z',scopes:['read_assigned_thread','send_reply','react','publish_public_post']};
const consent={bot_id:botId,human_id:uid,status:'active',expires_at:'2026-11-01T00:00:00Z',scopes:['read_assigned_thread','send_reply','react']};
const check=(args={})=>policy.evaluateBotAction({bot:paid,action:'send_reply',recipientId:uid,consent,threadAssigned:true,requestId,now,...args});
test('bot username is visibly distinct from any human username',()=>{
 assert.equal(policy.canonicalBotUsername(' @bot_luo_helper '),'bot_luo_helper');
 for(const invalid of ['luo_helper','admin','bot_X','bot_123','bot_a','bot_'+('a'.repeat(30)),null])assert.equal(policy.canonicalBotUsername(invalid),null);
});
test('unpaid, expired, suspended and unapproved bot identities are denied before quotas',()=>{
 for(const patch of [{payment_status:'unpaid'},{payment_status:'past_due'},{payment_status:'refunded'},{payment_status:'disputed'},{paid_until:'2026-10-20T00:00:00Z'},{moderation_status:'pending'},{moderation_status:'blocked'},{suspended:true},{tier:'unknown'}]){
  const answer=check({bot:{...paid,...patch}});
  assert.equal(answer.allowed,false,JSON.stringify(patch));
  assert.equal(answer.reason,'inactive_entitlement');
 }
});
test('no unsupported human-only features can be enabled by granting scopes or paying',()=>{
 for(const name of policy.BOT_DISABLED_ACTIONS){
  assert.equal(check({action:name,bot:{...paid,scopes:[...paid.scopes,name]}}).reason,'unsupported_action',name);
 }
 assert.equal(check({action:'delete_account'}).allowed,false);
});
test('bot can only read or write a personally opted-in, assigned private thread',()=>{
 assert.equal(check().allowed,true);
 for(const patch of [
  {consent:null},{consent:{...consent,status:'revoked'}},
  {consent:{...consent,expires_at:'2026-10-23T11:59:00Z'}},
  {consent:{...consent,scopes:[]}},
  {consent:{...consent,human_id:'44444444-4444-4444-8444-444444444444'}},
  {recipientId:null},
  {threadAssigned:false},
  {bot:{...paid,scopes:['read_assigned_thread']}},
  {requestId:'repeated'},
 ]){
  assert.equal(check(patch).allowed,false,JSON.stringify(patch));
 }
});
test('even valid consent cannot exceed bot and per-recipient budgets',()=>{
 for(const [key,value] of [['minute',6],['day',180],['recipientMinute',2]]){
  assert.equal(check({usage:{[key]:value}}).reason,'quota_exceeded');
 }
 assert.equal(check({usage:{minute:5,day:179,recipientMinute:1}}).allowed,true);
 assert.equal(check({usage:{minute:-1}}).reason,'invalid_usage');
});
test('public posting is tightly throttled and cannot target an unsuspecting human',()=>{
 assert.equal(check({action:'publish_public_post',recipientId:null,consent:null,threadAssigned:false}).allowed,true);
 assert.equal(check({action:'publish_public_post',usage:{minute:2},recipientId:null}).allowed,false);
});
test('bot label cannot be hidden from a public profile',()=>{
 const p=policy.safeBotPublicProfile({...paid,username:'bot_helpdesk'});
 assert.equal(p.account_type,'automated_agent');
 assert.equal(p.label,'AI Bot');
 assert.equal(p.username,'bot_helpdesk');
 assert.equal(p.verified_paid,true);
 assert.equal(policy.safeBotPublicProfile({...paid,username:'bot_helpdesk',payment_status:'unpaid'}).verified_paid,false);
});
test('paid access requires independently verified callback, exact order and non-refunded settlement',()=>{
 const order={state:'pending',provider:'paymob',provider_order_id:'order_12345',bot_id:botId,amount_minor:25000,currency:'EGP',tier:'agent_basic'};
 const event={provider:'paymob',event_id:'paymob_tx_12345',order_id:'order_12345',bot_id:botId,amount_minor:25000,currency:'EGP',status:'paid',occurred_at:'2026-10-23T11:59:00Z'};
 assert.equal(policy.validatePaymentFulfillment({verified:true,order,event,now}).allowed,true);
 for(const [k,v] of [['amount_minor',24999],['currency','USD'],['bot_id',uid],['provider','paddle'],['status','pending'],['refunded',true],['disputed',true],['occurred_at','2027-01-01T00:00:00Z']]){
  const result=policy.validatePaymentFulfillment({verified:true,order,event:{...event,[k]:v},now});
  assert.equal(result.allowed,false,k);
 }
 assert.equal(policy.validatePaymentFulfillment({verified:false,order,event,now}).reason,'unverified_signature');
});
test('private bot tables and server-only quota RPC are not accessible to ordinary clients',async(t)=>{
 // The reproducibility check intentionally copies web assets, not DB migration files.
 // Validate SQL in the source checkout, skip only when testing that web-only artifact.
 let migration;
 try{migration=await readFile('supabase/migrations/20261023144000_paid_luo_bot_foundation.sql','utf8')}
 catch(e){if(e?.code==='ENOENT'){t.skip('Server migrations are excluded from the clean web-only artifact');return}throw e}
 assert.match(migration,/create schema if not exists luo_bots/i);
 assert.match(migration,/revoke all on schema luo_bots from public,anon,authenticated/i);
 assert.match(migration,/revoke all on function public\.reserve_luo_bot_action[\s\S]+?from public,anon,authenticated/i);
 assert.match(migration,/grant execute on function public\.reserve_luo_bot_action[\s\S]+?to service_role/i);
 assert.match(migration,/where c\.bot_id=p_bot_id and c\.human_id=p_human_id/i);
 assert.match(migration,/p_action=any\(c\.scopes\)/i);
 assert.match(migration,/count\(\*\) from public\.conversation_members/i);
 assert.match(migration,/bot_user_id is null/i);
 assert.match(migration,/payment_status<>'active'/i);
 assert.match(migration,/moderation_status<>'approved'/i);
 assert.match(migration,/insert into luo_bots\.action_receipts/i);
 assert.match(migration,/pg_advisory_xact_lock/i);
 assert.match(migration,/grant execute on function public\.pause_own_luo_bot[\s\S]+?to authenticated/i);
});
