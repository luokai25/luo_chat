import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',E='20000000-0000-4000-8000-000000000001',O='30000000-0000-4000-8000-000000000001',path=A+'/'+E+'/clip.mp4';
test('local staging: actual clip-inspection SQL denies forged publication and protects validated object bytes',async t=>{
 const db=new PGlite();try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
   create schema auth;create schema storage;create schema luo_internal;
   create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to authenticated;grant execute on function auth.uid() to authenticated;
   create table storage.objects(id uuid primary key,bucket_id text,name text,owner_id text,version text,metadata jsonb,unique(bucket_id,name));
   alter table storage.objects enable row level security;
   grant select,insert,update,delete on storage.objects to authenticated;
   create policy owner_only on storage.objects for all to authenticated using(owner_id=auth.uid()::text) with check(owner_id=auth.uid()::text);
   create table luo_internal.space_entries(id uuid primary key,owner_id uuid,kind text,published boolean,media jsonb);
   insert into storage.objects values('${O}','luo-social','${path}','${A}','version-one','{"mimetype":"video/mp4","size":1234}');
   insert into luo_internal.space_entries values('${E}','${A}','clip',false,'[]');`);
  await db.exec(await readFile('supabase/proposals/clip-inspection.sql','utf8'));
  const proof=[path,O,'version-one','a'.repeat(64),1234,.4,64,96,'video/mp4','luo-reel-v1'];
  const record=()=>db.query('select public.record_luo_clip_inspection($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',proof);
  const publish=()=>db.query('update luo_internal.space_entries set published=true,media=$1 where id=$2',[JSON.stringify([{path,duration:1}]),E]);
  await t.test('uninspected video cannot publish even when the browser claims a valid duration',async()=>{await assert.rejects(publish(),/waiting for trusted media inspection/)});
  await t.test('ordinary users cannot write or read inspection receipts or call the worker RPC',async()=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${A}',false)`);await assert.rejects(record(),/permission denied/);await assert.rejects(db.query('select public.get_luo_clip_inspection_source($1)',[path]),/permission denied/);await assert.rejects(db.query('select * from luo_internal.clip_inspections'),/permission denied/);await db.exec('reset role')});
  await t.test('stale object versions cannot be attested by the trusted worker',async()=>{proof[2]='stale';await assert.rejects(record(),/changed or is unavailable/);proof[2]='version-one'});
  await t.test('a trusted verified receipt enables publication and overwrites the browser duration',async()=>{await db.exec('set role service_role');await record();await record();proof[5]=.5;await assert.rejects(record(),/retry conflict/);proof[5]=.4;await db.exec('reset role');await publish();const rows=await db.query('select media from luo_internal.space_entries');assert.equal(rows.rows[0].media[0].duration,.4)});
  await t.test('validated objects cannot be overwritten, removed or their path reused by browser roles',async()=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${A}',false)`);assert.equal((await db.query('update storage.objects set version=$1 where id=$2 returning id',['changed',O])).rows.length,0);assert.equal((await db.query('delete from storage.objects where id=$1 returning id',[O])).rows.length,0);await assert.rejects(db.query("insert into storage.objects values(gen_random_uuid(),'luo-social',$1,$2,'v2','{}')",[path,A]),/Inspected media is immutable/);await db.exec('reset role')});
  await t.test('a receipt cannot authorize another owner or a changed storage version',async()=>{await assert.rejects(db.query('update luo_internal.space_entries set owner_id=$1 where id=$2',[B,E]),/Invalid inspected clip path/);await db.query("update storage.objects set version='privileged-change' where id=$1",[O]);await assert.rejects(publish(),/waiting for trusted media inspection/)});
  await t.test('volatile storage guard still denies modifications if an earlier policy snapshot allowed a write',async()=>{await db.exec('drop policy inspected_clip_update_guard on storage.objects');await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${A}',false)`);try{await assert.rejects(db.query("update storage.objects set version='attempted-bypass' where id=$1",[O]),/immutable/);await assert.rejects(db.query("update storage.objects set bucket_id='elsewhere' where id=$1",[O]),/immutable/)}finally{await db.exec('reset role')}});
 }finally{await db.close()}
});
