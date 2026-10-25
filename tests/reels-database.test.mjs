import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Execute the actual proposed PL/pgSQL locally. Upstream auth/social/chat contracts
// below are deliberately minimal fixtures, not a claim of a hosted restore test.
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',C='10000000-0000-4000-8000-000000000003',D='10000000-0000-4000-8000-000000000004';
const PUBLIC='20000000-0000-4000-8000-000000000001',PRIVATE='20000000-0000-4000-8000-000000000002',AB='30000000-0000-4000-8000-000000000001',BC='30000000-0000-4000-8000-000000000002';
const id=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('proposed Reels SQL: isolated Postgres authorization and persistence contracts',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create schema luo_internal;create schema storage;
 create table storage.objects(id uuid primary key,bucket_id text,name text,owner_id text,version text,metadata jsonb);
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create table public.profiles(id uuid primary key,username text,display_name text,avatar_url text);
 create table public.conversations(id uuid primary key,kind text);
 create table public.conversation_members(conversation_id uuid,user_id uuid,primary key(conversation_id,user_id));
 create table public.chat_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_id uuid,body text,client_operation_id text,unique(sender_id,client_operation_id));
 create table luo_internal.space_entries(id uuid primary key,owner_id uuid,kind text,published boolean,audience text,body text default '',media jsonb default '[]',created_at timestamptz default now());
 create table luo_internal.space_responses(id uuid primary key,entry_id uuid references luo_internal.space_entries on delete cascade,user_id uuid,kind text,body text,data jsonb default '{}',created_at timestamptz default now());
 create table luo_internal.space_limits(user_id uuid,slot timestamptz,uses int,primary key(user_id,slot));
 create function luo_internal.space_blocked(a uuid,b uuid) returns boolean language sql stable as $$select (a='${D}' or b='${D}') and a<>b$$;
 create function luo_internal.space_visible(e luo_internal.space_entries,a uuid) returns boolean language sql stable as $$select e.published and not luo_internal.space_blocked(a,e.owner_id) and (e.audience='public' or a in(e.owner_id,'${B}'::uuid))$$;
 create function luo_internal.space_dto(e luo_internal.space_entries,a uuid) returns jsonb language sql stable as $$select to_jsonb(e)$$;
 create function public.can_write_luo_room(room uuid) returns boolean language sql stable as $$select exists(select 1 from public.conversation_members where conversation_id=room and user_id=auth.uid())$$;
 create function public.luo_space(action text,input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
  if auth.uid() is null then raise exception 'Sign in required';end if;
  insert into luo_internal.space_responses(id,entry_id,user_id,kind,body) values((input->>'operation')::uuid,(input->>'id')::uuid,auth.uid(),input->>'kind',input->>'body');return '{}';end$$;
 create function public.send_chat_message_idempotent(room uuid,op text,body text,kind text,parent uuid) returns public.chat_messages language plpgsql security definer set search_path='' as $$declare m public.chat_messages;begin
  insert into public.chat_messages(conversation_id,sender_id,body,client_operation_id) values(room,auth.uid(),body,op) on conflict(sender_id,client_operation_id) do nothing returning * into m;
  if m.id is null then select * into m from public.chat_messages x where x.sender_id=auth.uid() and x.client_operation_id=op;
   if m.body<>body or m.conversation_id<>room then raise exception 'Operation conflict';end if;end if;return m;end$$;
 insert into auth.users values('${A}'),('${B}'),('${C}'),('${D}');
 insert into public.profiles select id,'person-'||right(id::text,1),'Person',null from auth.users;
 insert into luo_internal.space_entries(id,owner_id,kind,published,audience,created_at) values('${PUBLIC}','${A}','clip',true,'public','2026-10-25 00:00:00.123456+00'),('${PRIVATE}','${A}','clip',true,'friends','2026-10-25 00:00:00.123456+00');
 insert into public.conversations values('${AB}','direct'),('${BC}','direct');
 insert into public.conversation_members values('${AB}','${A}'),('${AB}','${B}'),('${BC}','${B}'),('${BC}','${C}');
 `);
 await db.exec(await readFile('supabase/proposals/reels-social-v2.sql','utf8'));
 // Validate that both actual proposals coexist. Managed Auth/Storage services
 // remain minimal fixtures, not a hosted schema restore certification.
 await db.exec(await readFile('supabase/proposals/clip-inspection.sql','utf8'));
 const as=async actor=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(actor?{sub:actor,role:'authenticated'}:{})]);await db.exec('set role authenticated')};
 const call=async(action,input={})=>(await db.query('select public.luo_reels($1,$2::jsonb) result',[action,JSON.stringify(input)])).rows[0].result;
 await t.test('anonymous and missing-identity calls denied; direct private table access denied',async()=>{
  await as(null);await assert.rejects(call('capabilities'),/Sign in/);await as(B);
  await assert.rejects(db.query('select * from luo_internal.reel_follows'),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(call('capabilities'),/permission denied/);await as(B);
 });
 await t.test('follow persists, is idempotent and never grants private content access',async()=>{
  assert.equal((await call('follow',{id:PUBLIC,enabled:true})).following,true);
  assert.equal((await call('follow',{id:PUBLIC,enabled:true})).following,true);
  assert.equal((await call('feed',{mode:'following'})).length,2);
  await as(C);await call('follow',{id:PUBLIC,enabled:true});assert.equal((await call('feed',{mode:'following'})).length,1);
  await assert.rejects(call('state',{id:PRIVATE}),/unavailable/);await as(A);await assert.rejects(call('follow',{id:PUBLIC,enabled:true}),/yourself/);await as(B);
 });
 await t.test('reposts and recommendation choices persist without widening visibility',async()=>{
  assert.equal((await call('repost',{id:PUBLIC,enabled:true})).reposts,1);assert.equal((await call('repost',{id:PUBLIC,enabled:true})).reposts,1);
  await assert.rejects(call('repost',{id:PRIVATE,enabled:true}),/Only public/);
  await call('interest',{id:PUBLIC,kind:'hidden',enabled:true});assert.equal((await call('feed',{mode:'explore'})).length,0);
  await call('interest',{id:PUBLIC,kind:'hidden',enabled:false});assert.equal((await call('feed',{mode:'explore'})).length,1);
 });
 await t.test('comments and replies survive reload, retry exactly once and cannot cross clips',async()=>{
  const root=await call('comment',{id:PUBLIC,operation:id(1),body:'A comment'});assert.equal(root.body,'A comment');
  await call('comment',{id:PUBLIC,operation:id(1),body:'A comment'});assert.equal((await call('comments',{id:PUBLIC})).length,1);
  await assert.rejects(call('comment',{id:PUBLIC,operation:id(1),body:'Changed retry'}),/conflict/);
  await call('comment',{id:PUBLIC,operation:id(2),parent_id:id(1),body:'A reply'});assert.equal((await call('comments',{id:PUBLIC,parent_id:id(1)})).length,1);
  assert.equal((await call('comments',{id:PUBLIC}))[0].replies,1);
  await assert.rejects(call('comment',{id:PRIVATE,operation:id(3),parent_id:id(1),body:'Wrong clip'}),/unavailable/);
  await assert.rejects(call('comment',{id:PUBLIC,operation:id(3),parent_id:id(2),body:'Nested too deeply'}),/unavailable/);
 });
 await t.test('comment likes are idempotent; only author can pin; removal erases original text',async()=>{
  assert.equal((await call('comment.like',{id:PUBLIC,comment_id:id(1),enabled:true})).likes,1);
  assert.equal((await call('comment.like',{id:PUBLIC,comment_id:id(1),enabled:true})).likes,1);
  await assert.rejects(call('comment.pin',{id:PUBLIC,comment_id:id(1),enabled:true}),/Only the clip author/);
  await as(C);await assert.rejects(call('comment.remove',{id:PUBLIC,comment_id:id(1)}),/Only the comment/);
  await as(A);assert.equal((await call('comment.pin',{id:PUBLIC,comment_id:id(1),enabled:true})).pinned,true);
  const removed=await call('comment.remove',{id:PUBLIC,comment_id:id(1)});assert.equal(removed.body,'[Comment removed]');assert.equal(removed.pinned,false);
  assert.equal((await call('comments',{id:PUBLIC,parent_id:id(1)})).length,1,'Existing replies remain readable after root removal');await assert.rejects(call('comment',{id:PUBLIC,parent_id:id(1),operation:id(11),body:'New reply'}),/unavailable/);
  await db.exec('reset role');assert.equal((await db.query('select body from luo_internal.space_responses where id=$1',[id(1)])).rows[0].body,'[Comment removed]');await as(B);
 });
 await t.test('recipient list excludes unauthorized rooms, shares recheck visibility and retry atomically',async()=>{
  const rooms=await call('recipients',{id:PRIVATE,rooms:[AB,BC]});assert.deepEqual(rooms.map(r=>r.id),[AB]);
  await assert.rejects(call('share',{id:PRIVATE,room:BC,operation:id(8)}),/cannot view/);
  const first=await call('share',{id:PUBLIC,room:BC,operation:id(9)});const retry=await call('share',{id:PUBLIC,room:BC,operation:id(9)});assert.equal(first.message_id,retry.message_id);
  await as(C);await assert.rejects(call('share',{id:PUBLIC,room:AB,operation:id(10)}),/unavailable/);await as(D);await assert.rejects(call('state',{id:PUBLIC}),/unavailable/);
 });
 await t.test('validation and throttling reject malformed requests',async()=>{
  await as(B);await assert.rejects(call('feed',{mode:'saved',before:'2026-01-01'}),/Incomplete cursor/);
  await assert.rejects(call('recipients',{id:PUBLIC,rooms:Array(101).fill(AB)}),/at most 100/);
  await db.exec('reset role');await db.query("insert into luo_internal.space_limits values($1,date_trunc('minute',now()),40) on conflict(user_id,slot) do update set uses=40",[B]);await as(B);
  await assert.rejects(call('follow',{id:PUBLIC,enabled:false}),/slow down/);
 });
 await t.test('equal-timestamp feed and comment cursors traverse all rows without duplicates',async()=>{
  await db.exec('reset role');
  for(let n=1;n<=25;n++){
   const entry='50000000-0000-4000-8000-'+String(n).padStart(12,'0'),path=A+'/'+entry+'/'+entry+'.mp4';
   await db.query("insert into storage.objects values($1,'luo-social',$2,$3,'fixture-v1','{\"size\":1234,\"mimetype\":\"video/mp4\"}')",[entry,path,A]);
   await db.query('select public.record_luo_clip_inspection($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[path,entry,'fixture-v1','a'.repeat(64),1234,.4,64,96,'video/mp4','luo-reel-v1']);
   await db.query("insert into luo_internal.space_entries(id,owner_id,kind,published,audience,media,created_at) values($1,$2,'clip',true,'public',$3,'2026-10-25 00:00:00.123456+00')",[entry,A,JSON.stringify([{path,duration:.4}])]);
  }
  for(let n=20;n<75;n++)await db.query("insert into luo_internal.space_responses(id,entry_id,user_id,kind,body) values($1,$2,$3,'comment','Pagination fixture')",[id(n),PUBLIC,B]);
  await as(B);const first=await call('feed',{mode:'explore'});assert.equal(first.length,20);const last=first.at(-1),second=await call('feed',{mode:'explore',before:last.created_at,before_id:last.id});assert.equal(new Set([...first,...second].map(r=>r.id)).size,26);
  const comments=await call('comments',{id:PUBLIC});assert.equal(comments.length,50);const rest=await call('comments',{id:PUBLIC,after:comments.at(-1).id});assert.equal(new Set([...comments,...rest].map(r=>r.id)).size,56);
  await as(A);await call('comment.pin',{id:PUBLIC,comment_id:id(74),enabled:true});await as(B);const pinned=await call('comments',{id:PUBLIC});assert.equal(pinned[0].id,id(74));const remaining=await call('comments',{id:PUBLIC,after:pinned.at(-1).id});assert.equal(new Set([...pinned,...remaining].map(r=>r.id)).size,56,'Pinned comments do not corrupt the UUID cursor');
 });
 }finally{await db.close()}
});
