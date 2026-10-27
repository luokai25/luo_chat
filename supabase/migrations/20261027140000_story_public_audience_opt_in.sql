-- Public Stories are staged behind an operator-controlled flag. Default OFF.
-- Apply to staging, run security/age-moderation checks, then enable explicitly.
-- Existing private Stories remain private and all existing recipients keep RLS.
alter table public.chat_stories
 add column if not exists is_public boolean not null default false;

create table if not exists public.chat_story_public_release (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.chat_story_public_release enable row level security;
revoke all on public.chat_story_public_release from public,anon,authenticated;
insert into public.chat_story_public_release(singleton,enabled)
 values(true,false) on conflict(singleton) do nothing;

-- This capability returns true only when an operator enables the feature.
create or replace function public.chat_public_story_ready()
 returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select f.enabled from public.chat_story_public_release f where f.singleton=true),false);
$$;
revoke all on function public.chat_public_story_ready() from public,anon;
grant execute on function public.chat_public_story_ready() to authenticated;

-- RLS remains server-side. Only signed-in Luo Chat members see public stories,
-- and the operator gate can immediately hide public stories if needed.
create or replace function public.can_view_chat_story(target_story_id uuid)
 returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.chat_stories s
  where s.id=target_story_id and s.expires_at>now()
  and (
   s.owner_id=auth.uid()
   or (s.is_public and public.chat_public_story_ready())
   or exists(
    select 1 from public.chat_story_recipients r
    where r.story_id=s.id and r.user_id=auth.uid()
   )
  )
 );
$$;
revoke all on function public.can_view_chat_story(uuid) from public,anon;
grant execute on function public.can_view_chat_story(uuid) to authenticated;

-- Never allow direct client INSERT/UPDATE. Owners publish only through this RPC.
create or replace function public.create_public_chat_story(
 story_body text, uploaded_path text, uploaded_type text,
 music_link text, operation_id text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 result uuid;
 prior_public boolean;
begin
 if actor is null or not public.chat_public_story_ready() then
  raise exception 'Public Stories are not available on this server';
 end if;
 if length(coalesce(story_body,''))>2000
  or length(coalesce(operation_id,'')) not between 8 and 100
  or (coalesce(story_body,'')='' and uploaded_path is null and coalesce(music_link,'')='')
 then raise exception 'Add supported Story content and a valid operation ID';end if;
 if music_link is not null and (length(music_link)>2000 or music_link!~'^https://')
 then raise exception 'Use an HTTPS music link';end if;
 if (uploaded_path is null)<>(uploaded_type is null)
 then raise exception 'A Story file requires its content type';end if;
 if uploaded_path is not null and not exists(
  select 1 from storage.objects o where
   o.bucket_id='luo-stories'
   and o.name=uploaded_path
   and split_part(o.name,'/',1)=actor::text
   and o.owner_id=actor::text
   and o.metadata->>'mimetype'=uploaded_type
 ) then raise exception 'Upload a supported Story file first';end if;
 insert into public.chat_stories(
  owner_id,body,media_path,media_type,music_url,client_operation_id,is_public
 ) values(
  actor,coalesce(story_body,''),uploaded_path,uploaded_type,music_link,operation_id,true
 )
 on conflict(owner_id,client_operation_id) do nothing
 returning id into result;
 if result is null then
  select id,is_public into result,prior_public
  from public.chat_stories
  where owner_id=actor and client_operation_id=operation_id;
  if result is null or not prior_public then
   raise exception 'This operation ID is already associated with a different audience';
  end if;
 end if;
 return result;
end;
$$;
revoke all on function public.create_public_chat_story(text,text,text,text,text)
 from public,anon;
grant execute on function public.create_public_chat_story(text,text,text,text,text)
 to authenticated;

-- Public is intentionally OFF after migration. Only a privileged database
-- operator may enable it after staging tests and content-safety review:
-- update public.chat_story_public_release
-- set enabled=true,updated_at=now() where singleton=true;
