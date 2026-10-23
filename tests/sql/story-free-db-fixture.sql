-- Free PostgreSQL CI fixture only. Never run on production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table auth.users(id uuid primary key);
create table public.chat_stories(
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 expires_at timestamptz not null,
 body text not null default ''
);
create table public.chat_story_recipients(
 story_id uuid references public.chat_stories(id),
 user_id uuid references auth.users(id),
 primary key(story_id,user_id)
);
create or replace function public.can_view_chat_story(target_story_id uuid)
 returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.chat_stories s where s.id=target_story_id
   and s.expires_at>now()
   and (s.owner_id=auth.uid()
    or exists(select 1 from public.chat_story_recipients r
      where r.story_id=s.id and r.user_id=auth.uid()))
 );
$$;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.chat_stories(id,owner_id,expires_at,body) values
 ('44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',now()+interval '1 day','Story text'),
 ('55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',now()-interval '1 day','Old Story');
insert into public.chat_story_recipients(story_id,user_id) values
 ('44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222');
