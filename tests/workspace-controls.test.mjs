import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const sql=await readFile('supabase/proposals/workspace-operator-controls.sql','utf8');
const owner='11111111-1111-4111-8111-111111111111',human='22222222-2222-4222-8222-222222222222',agent='33333333-3333-4333-8333-333333333333';
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema luo_workspace;create schema luo_billing;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz,banned_until timestamptz,deleted_at timestamptz,updated_at timestamptz,raw_app_meta_data jsonb default '{}');
create table public.profiles(id uuid primary key,username text);alter table public.profiles enable row level security;create policy normal_read on public.profiles for select to authenticated using(true);grant select on public.profiles to authenticated;
create table luo_workspace.admin_users(user_id uuid primary key);
create table luo_billing.agent_accounts(id uuid primary key,auth_user_id uuid,state text);
create table luo_billing.billing_subscriptions(agent_id uuid,provider text,provider_subscription_id text,status text,paid_through timestamptz,plan text,provider_synced_at timestamptz);
create table luo_billing.agent_api_keys(agent_id uuid,revoked_at timestamptz,token_hash bytea,expires_at timestamptz,scopes text[],session_generation bigint);
create table luo_billing.agent_session_leases(agent_id uuid,expires_at timestamptz,generation bigint);
create table luo_billing.payment_events(event_type text);
create function public.fixture_definer() returns text language plpgsql security definer as $$ begin return 'private'; end $$;
create function public.fixture_sql() returns table(id uuid,username text) language sql security definer as $$
 select * from public.profiles;
 $$;
insert into auth.users(id,email) values('${owner}','owner@example.invalid'),('${human}','person@example.invalid');insert into luo_workspace.admin_users values('${owner}');insert into public.profiles values('${human}','person');
insert into luo_billing.agent_accounts values('${agent}','${human}','active');insert into luo_billing.billing_subscriptions values('${agent}','paypal','I-FIXTURE','active',now()+interval '30 days','starter',now());insert into luo_billing.agent_api_keys(agent_id) values('${agent}');insert into luo_billing.agent_session_leases(agent_id,expires_at) values('${agent}',now()+interval '1 hour');`);await db.exec(sql);await db.exec(await readFile('supabase/proposals/workspace-preserve-independent-ban.sql','utf8'));return db;}
async function who(db,id){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function action(db,name,payload,id='44444444-4444-4444-8444-444444444444'){return(await db.query('select public.luo_workspace_control($1,$2,$3,$4) result',[name,JSON.stringify(payload),'Reviewed operator test',id])).rows[0].result;}
test('controls reject outsiders, protect owners, audit retries and enforce revision conflicts',async()=>{const db=await setup();try{
await who(db,human);await assert.rejects(db.query('select public.luo_workspace_control_snapshot()'),e=>e.code==='42501');await who(db,owner);
await assert.rejects(action(db,'suspend_account',{user_id:owner}));
const result=await action(db,'hold',{revision:1,enabled:true});assert.equal(result.ok,true);assert.deepEqual(await action(db,'hold',{revision:1,enabled:true}),result);
await assert.rejects(action(db,'hold',{revision:1,enabled:false}));await assert.rejects(action(db,'feature',{revision:1,name:'posts',enabled:false},'55555555-5555-4555-8555-555555555555'),e=>e.code==='40001');
const snap=(await db.query('select public.luo_workspace_control_snapshot() value')).rows[0].value;assert.equal(snap.settings.deployment_hold,true);assert.equal(snap.audit.length,1);
for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.luo_agent_runtime_controls()','execute') ok",[role])).rows[0].ok,false);
}finally{await db.close()}});
test('suspension immediately denies old JWT/RLS and paid entitlement; restoration preserves payment and revoked keys',async()=>{const db=await setup();try{
await who(db,owner);assert.equal((await db.query('select public.luo_agent_has_active_entitlement($1) ok',[agent])).rows[0].ok,true);
await action(db,'suspend_account',{user_id:human});await who(db,human);assert.equal((await db.query('select public.luo_workspace_account_is_active() ok')).rows[0].ok,false);
await assert.rejects(db.query('select public.luo_workspace_check_access()'),e=>e.code==='42501');await assert.rejects(db.query('select public.fixture_definer()'),e=>e.code==='42501');await assert.rejects(db.query('select * from public.fixture_sql()'),e=>e.code==='42501');await db.exec('set role authenticated');assert.equal((await db.query('select * from public.profiles')).rows.length,0);await db.exec('reset role');
assert.equal((await db.query('select public.luo_agent_has_active_entitlement($1) ok',[agent])).rows[0].ok,false);
await who(db,owner);await action(db,'activate_account',{user_id:human},'55555555-5555-4555-8555-555555555555');assert.equal((await db.query('select public.luo_agent_has_active_entitlement($1) ok',[agent])).rows[0].ok,true);assert.ok((await db.query('select revoked_at from luo_billing.agent_api_keys')).rows[0].revoked_at);
await db.query("update luo_billing.billing_subscriptions set paid_through=now()-interval '1 day'");assert.equal((await db.query('select public.luo_agent_has_active_entitlement($1) ok',[agent])).rows[0].ok,false);
}finally{await db.close()}});
test('financial ledger deduplicates provider transaction IDs and leaves unknown fees unknown',async()=>{const db=await setup();try{
await db.query("select public.luo_agent_record_cash('TX-FIXTURE','I-FIXTURE',1200,null,null,'2026-10-20T12:00:00Z')");await db.query("select public.luo_agent_record_cash('TX-FIXTURE','I-FIXTURE',1200,null,null,'2026-10-20T12:00:00Z')");await who(db,owner);const s=(await db.query('select public.luo_workspace_control_snapshot() value')).rows[0].value;assert.equal(s.finance.completed_count,1);assert.equal(s.finance.gross_minor,1200);assert.equal(s.finance.net_minor,null);assert.equal(s.finance.forecast_mrr_minor,1200);
await assert.rejects(db.query("select public.luo_agent_record_cash('TX-FIXTURE','I-FIXTURE',2400,null,null,'2026-10-20T12:00:00Z')"));
}finally{await db.close()}});

test('repeated suspension retains an independently changed Auth ban on restoration',async()=>{const db=await setup();try{await who(db,owner);await action(db,'suspend_account',{user_id:human});await db.query("update auth.users set banned_until='2027-01-01T00:00:00Z' where id=$1",[human]);await action(db,'suspend_account',{user_id:human},'55555555-5555-4555-8555-555555555555');await action(db,'activate_account',{user_id:human},'66666666-6666-4666-8666-666666666666');const value=(await db.query('select banned_until from auth.users where id=$1',[human])).rows[0].banned_until;assert.equal(new Date(value).toISOString(),'2027-01-01T00:00:00.000Z');}finally{await db.close()}});
