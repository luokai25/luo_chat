-- Disposable PostgreSQL 16 fixture for FREE CI only.
-- Never run against a live Supabase database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table auth.users(
 id uuid primary key,
 raw_app_meta_data jsonb not null default '{}'::jsonb
);
create table public.profiles(
 id uuid primary key references auth.users(id),
 username text unique not null
);
create table public.conversations(id uuid primary key);
create table public.conversation_members(
 conversation_id uuid not null references public.conversations(id),
 user_id uuid not null references auth.users(id),
 primary key(conversation_id,user_id)
);
insert into auth.users(id,raw_app_meta_data) values
 ('11111111-1111-4111-8111-111111111111','{"luo_account_type":"human"}'),
 ('22222222-2222-4222-8222-222222222222','{"luo_account_type":"bot"}'),
 ('33333333-3333-4333-8333-333333333333','{"luo_account_type":"human"}'),
 ('44444444-4444-4444-8444-444444444444','{"luo_account_type":"human"}');
insert into public.profiles(id,username) values
 ('11111111-1111-4111-8111-111111111111','owner'),
 ('22222222-2222-4222-8222-222222222222','bot_fixture'),
 ('33333333-3333-4333-8333-333333333333','alice'),
 ('44444444-4444-4444-8444-444444444444','stranger');
insert into public.conversations(id)
values ('55555555-5555-4555-8555-555555555555');
insert into public.conversation_members(conversation_id,user_id) values
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222'),
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333');
