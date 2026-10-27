import test from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const foundation=await readFile('supabase/migrations/20261027052053_agent_billing_production_foundation_20261027.sql','utf8');
const signupFix=await readFile('supabase/proposals/agent-signup-quota-and-identity-isolation.sql','utf8');
const bindingFix=await readFile('supabase/proposals/agent-verification-binding-and-probe-cleanup.sql','utf8');
async function setup(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;create schema luo_agent_verify;
create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
create table public.profiles(id uuid primary key references auth.users,username text,display_name text,bio text);
create table public.user_chat_settings(user_id uuid primary key references auth.users);
create table luo_agent_verify.requests(id uuid primary key,username text,key_fingerprint text,state text,verified_until timestamptz);
set check_function_bodies=false;
`);await db.exec(foundation);await db.exec(signupFix);await db.exec(bindingFix);await db.exec('set check_function_bodies=true');return db;}
const auth='11111111-1111-4111-8111-111111111111',proof='22222222-2222-4222-8222-222222222222';
async function pending(db,probe=true){
 await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,'agent+launch_fixture@agents.luo.invalid',$2)",[auth,JSON.stringify({luo_identity_type:'ai_agent',...(probe?{luo_launch_probe:true}:{})})]);
 await db.query("insert into luo_agent_verify.requests values($1,'launch_fixture',$2,'verified',now()+interval '30 days',null)",[proof,'a'.repeat(64)]);
 return (await db.query("select public.luo_agent_create_verified_pending_identity($1,'launch_fixture','starter',$2) id",[auth,proof])).rows[0].id;
}
test('complete production schema binds a verified key, denies unpaid access and cleans only its own unpaid probe',async()=>{
 const db=await setup();try{
  const agent=await pending(db);
  assert.equal((await db.query('select claimed_agent_id from luo_agent_verify.requests where id=$1',[proof])).rows[0].claimed_agent_id,agent);
  assert.equal((await db.query("select public.luo_agent_find_verified_paid_identity($1,'launch_fixture') id",[auth])).rows[0].id,null);
  assert.equal((await db.query("select public.luo_agent_verified_checkout_eligible($1,'launch_fixture','starter') ok",[auth])).rows[0].ok,true);
  await assert.rejects(db.query('delete from auth.users where id=$1',[auth]),e=>['23503','23001'].includes(e.code));
  assert.equal((await db.query('select public.luo_agent_discard_launch_probe($1) ok',[auth])).rows[0].ok,true);
  assert.equal((await db.query('select claimed_agent_id from luo_agent_verify.requests where id=$1',[proof])).rows[0].claimed_agent_id,null);
  await db.query('delete from auth.users where id=$1',[auth]);
  assert.equal((await db.query('select public.luo_agent_discard_launch_probe($1) ok',[auth])).rows[0].ok,false);
 }finally{await db.close()}
});
test('probe cleanup cannot discard a customer or any pending checkout and remains service-only',async()=>{
 const db=await setup();try{
  const agent=await pending(db,false);
  assert.equal((await db.query('select public.luo_agent_discard_launch_probe($1) ok',[auth])).rows[0].ok,false);
  await db.query("update auth.users set raw_app_meta_data=raw_app_meta_data||'{\"luo_launch_probe\":true}' where id=$1",[auth]);
  await db.query("select public.luo_agent_reserve_checkout($1,'starter','paypal',false)",[auth]);
  await assert.rejects(db.query('select public.luo_agent_discard_launch_probe($1)',[auth]),e=>e.code==='42501');
  assert.equal((await db.query('select count(*)::int n from luo_billing.agent_accounts where id=$1',[agent])).rows[0].n,1);
  for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.luo_agent_discard_launch_probe(uuid)','execute') ok",[role])).rows[0].ok,false);
 }finally{await db.close()}
});
// Provider evidence here is a local database fixture, never a real or production payment.
test('production SQL reconciles local paid evidence, serves quota-limited posts and revokes access on suspension',async()=>{
 const db=await setup();try{
  const agent=await pending(db);
  const intent=(await db.query("select public.luo_agent_reserve_checkout($1,'starter','paypal',false) value",[auth])).rows[0].value;
  assert.equal((await db.query("select public.luo_agent_attach_checkout($1,'I-FIXTURE12345') ok",[intent.intent_id])).rows[0].ok,true);
  const paid=await db.query("select public.luo_agent_record_reconciled_checkout($1,'paypal','I-FIXTURE12345','WH-FIXTURE-PAID','PAYMENT.SALE.COMPLETED','I-FIXTURE12345','PAYER12345','P-FIXTURE12345',1200,now()+interval '30 days') result",[intent.intent_id]);
  assert.equal(paid.rows[0].result,'active');
  assert.equal((await db.query("select public.luo_agent_find_verified_paid_identity($1,'launch_fixture') id",[auth])).rows[0].id,agent);
  await db.query("select public.luo_agent_replace_session($1,decode(repeat('a',64),'hex'),3600)",[agent]);
  await db.query("select public.luo_agent_issue_api_key($1,decode(repeat('b',64),'hex'),'luoa_fixture',array['profile:read','usage:read','posts:read','posts:write'])",[agent]);
  const operation='33333333-3333-4333-8333-333333333333';
  const post=(await db.query("select public.luo_agent_publish_post($1,$2,'Hello from a paid AI fixture') value",[agent,operation])).rows[0].value;
  const duplicate=(await db.query("select public.luo_agent_publish_post($1,$2,'Hello from a paid AI fixture') value",[agent,operation])).rows[0].value;
  assert.equal(duplicate.id,post.id);assert.equal(duplicate.duplicate,true);
  const feed=(await db.query('select public.luo_agent_read_public_posts($1,null,null,10) value',[agent])).rows[0].value;assert.equal(feed[0].identity_label,'AI Agent');
  assert.equal((await db.query("select public.luo_agent_read_usage($1) value",[agent])).rows[0].value.usage.post,1);
  await assert.rejects(db.query('select public.luo_agent_discard_launch_probe($1)',[auth]),e=>e.code==='42501');
  await db.query("select public.luo_agent_suspend_paid_identity('paypal','I-FIXTURE12345','WH-FIXTURE-REFUND','paused')");
  assert.equal((await db.query('select public.luo_agent_has_active_entitlement($1) ok',[agent])).rows[0].ok,false);
  assert.equal((await db.query('select revoked_at is not null revoked from luo_billing.agent_api_keys where agent_id=$1',[agent])).rows[0].revoked,true);
  await assert.rejects(db.query("select public.luo_agent_publish_post($1,$2,'Unpaid post must fail')",[agent,'44444444-4444-4444-8444-444444444444']),e=>e.code==='28000');
 }finally{await db.close()}
});
