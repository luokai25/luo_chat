import test from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const migration=await readFile('supabase/proposals/agent-signup-quota-and-identity-isolation.sql','utf8');
async function setup(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema luo_billing;create schema auth;
create table luo_billing.agent_signup_buckets(day date,scope text check(scope in ('global','network','identity')),digest text check(length(digest) between 4 and 128),attempts int check(attempts between 0 and 1000),primary key(day,scope,digest));
create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
create table public.profiles(id uuid primary key references auth.users on delete cascade,username text unique,display_name text,bio text default '');
create table luo_billing.agent_accounts(id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users on delete cascade,username text unique,display_name text,requested_plan text,state text);
create table public.user_chat_settings(user_id uuid primary key references auth.users on delete cascade);
`);await db.exec(migration);await db.exec(`
create trigger on_auth_user_created_luo_chat after insert on auth.users for each row execute function public.handle_new_chat_user();
create trigger on_auth_user_created_luo_profile after insert on auth.users for each row execute function public.handle_new_user();
`);return db;}
const reserve=(db,name,network)=>db.query('select public.luo_agent_reserve_pending_signup($1,$2) ok',[name.padStart(64,'0'),network.padStart(64,'0')]);
test('real signup constraints accept the global counter and preserve atomic network/identity caps',async()=>{
 const db=await setup();try{
  assert.equal((await reserve(db,'aa','bb')).rows[0].ok,true);
  await assert.rejects(reserve(db,'aa','bb'),e=>e.code==='P0001');
  await reserve(db,'ab','bb');await reserve(db,'ac','bb');
  await assert.rejects(reserve(db,'ad','bb'),e=>e.code==='P0001');
  assert.equal((await db.query("select attempts from luo_billing.agent_signup_buckets where scope='global'")).rows[0].attempts,3);
  for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.luo_agent_reserve_pending_signup(text,text)','execute') allowed",[role])).rows[0].allowed,false);
 }finally{await db.close()}
});
test('global signup cap remains 30 across different identities and networks',async()=>{
 const db=await setup();try{for(let n=0;n<30;n++)await reserve(db,n.toString(16),n.toString(16));await assert.rejects(reserve(db,'ff','ff'),e=>e.code==='P0001');}finally{await db.close()}
});
test('AI Auth identities cannot acquire human profiles; ordinary human signup remains intact',async()=>{
 const db=await setup();try{
  const ai='11111111-1111-4111-8111-111111111111',human='22222222-2222-4222-8222-222222222222';
  await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,'agent+test@agents.luo.invalid','{\"luo_identity_type\":\"ai_agent\"}')",[ai]);
  assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n,0);
  const pending=await db.query("select public.luo_agent_create_pending_identity($1,'test_agent','starter') id",[ai]);assert.ok(pending.rows[0].id);
  await assert.rejects(db.query("select public.luo_agent_create_pending_identity($1,'luo_reserved','starter')",[ai]),e=>e.code==='22023');
  assert.equal((await db.query('select count(*)::int n from public.user_chat_settings')).rows[0].n,0);
  await assert.rejects(db.query("insert into public.profiles(id,username,display_name) values($1,'fakehuman','Fake human')",[ai]),e=>e.code==='42501');
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'human@example.invalid','{\"username\":\"realhuman\",\"luo_identity_type\":\"ai_agent\"}')",[human]);
  assert.equal((await db.query('select username from public.profiles where id=$1',[human])).rows[0].username,'realhuman');
  assert.equal((await db.query('select count(*)::int n from public.user_chat_settings')).rows[0].n,1);
 }finally{await db.close()}
});
