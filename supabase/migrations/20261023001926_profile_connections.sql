-- Mutual friendships are separate from the existing private contact book.
create table public.chat_connections (
 user_low uuid not null references public.profiles(id) on delete cascade,
 user_high uuid not null references public.profiles(id) on delete cascade,
 requester_id uuid not null references public.profiles(id) on delete cascade,
 state text not null check(state in ('pending','accepted','closed')),
 updated_at timestamptz not null default now(),
 primary key(user_low,user_high),
 check(user_low<user_high), check(requester_id in (user_low,user_high))
);
create index chat_connections_high_idx on public.chat_connections(user_high,user_low);
create index chat_connections_requester_idx on public.chat_connections(requester_id);
alter table public.chat_connections enable row level security;
revoke all on public.chat_connections from public,anon,authenticated;
grant select on public.chat_connections to authenticated;
create policy connections_participant_read on public.chat_connections for select to authenticated
 using ((select auth.uid()) in (user_low,user_high));
create table luo_internal.friend_request_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 day date not null, requests integer not null check(requests between 1 and 20)
);
revoke all on luo_internal.friend_request_limits from public,anon,authenticated;

create function public.change_chat_connection(target_user_id uuid, connection_action text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); lo uuid; hi uuid; c public.chat_connections; used integer;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 if target_user_id is null or target_user_id=actor or not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'Choose another Luo Chat user';end if;
 if connection_action is null or connection_action not in ('request','accept','decline','cancel','remove') then raise exception 'Unknown connection action';end if;
 lo:=least(actor,target_user_id);hi:=greatest(actor,target_user_id);
 -- Same pair lock is also used by blocking: no request can survive a concurrent block.
 perform pg_advisory_xact_lock(hashtextextended(lo::text||':'||hi::text,4721));
 if exists(select 1 from public.chat_user_blocks where (blocker_id=actor and blocked_id=target_user_id) or (blocker_id=target_user_id and blocked_id=actor)) then raise exception 'Connection unavailable';end if;
 select * into c from public.chat_connections where user_low=lo and user_high=hi for update;
 if connection_action='request' then
  if c.state in ('pending','accepted') then return;end if;
  if c.state='closed' and c.updated_at>now()-interval '1 day' then raise exception 'Please wait a day before sending another request';end if;
  insert into luo_internal.friend_request_limits(user_id,day,requests) values(actor,current_date,1)
   on conflict(user_id) do update set day=current_date,requests=case when friend_request_limits.day=current_date then friend_request_limits.requests+1 else 1 end
   where friend_request_limits.day<>current_date or friend_request_limits.requests<20 returning requests into used;
  if used is null then raise exception 'Daily friend request limit reached. Try again tomorrow' using errcode='P0001';end if;
  insert into public.chat_connections(user_low,user_high,requester_id,state) values(lo,hi,actor,'pending')
   on conflict(user_low,user_high) do update set requester_id=actor,state='pending',updated_at=now();
 elsif connection_action='accept' then
  if c.state='accepted' then return;end if;
  if c.state is distinct from 'pending' or c.requester_id=actor then raise exception 'No incoming request to accept';end if;
  update public.chat_connections set state='accepted',updated_at=now() where user_low=lo and user_high=hi;
 elsif connection_action='decline' then
  if c.state='closed' then return;end if;
  if c.state is distinct from 'pending' or c.requester_id=actor then raise exception 'No incoming request to decline';end if;
  update public.chat_connections set state='closed',updated_at=now() where user_low=lo and user_high=hi;
 elsif connection_action='cancel' then
  if c.state='closed' or c.user_low is null then return;end if;
  if c.state<>'pending' or c.requester_id<>actor then raise exception 'No outgoing request to cancel';end if;
  update public.chat_connections set state='closed',updated_at=now() where user_low=lo and user_high=hi;
 else
  if c.state='closed' or c.user_low is null then return;end if;
  if c.state<>'accepted' then raise exception 'No friendship to remove';end if;
  update public.chat_connections set state='closed',updated_at=now() where user_low=lo and user_high=hi;
 end if;
end;$$;

create or replace function public.set_chat_user_block(target_user_id uuid, should_block boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null or target_user_id is null or target_user_id=actor or should_block is null or not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'Choose another Luo Chat user.';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor,target_user_id)::text||':'||greatest(actor,target_user_id)::text,4721));
 if should_block then
  insert into public.chat_user_blocks(blocker_id,blocked_id) values(actor,target_user_id) on conflict do nothing;
  delete from public.chat_connections where user_low=least(actor,target_user_id) and user_high=greatest(actor,target_user_id);
 else delete from public.chat_user_blocks where blocker_id=actor and blocked_id=target_user_id;end if;
end;$$;

create function public.get_chat_person(target_user_id uuid)
returns table(id uuid,username text,display_name text,bio text,avatar_url text,profile_frame text,relationship text,is_blocked boolean)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 return query select p.id,p.username,p.display_name,p.bio,p.avatar_url,p.profile_frame,
  case when p.id=actor then 'self' when c.state='accepted' then 'friends' when c.state='pending' then case when c.requester_id=actor then 'outgoing' else 'incoming' end else 'none' end,
  exists(select 1 from public.chat_user_blocks b where b.blocker_id=actor and b.blocked_id=p.id)
 from public.profiles p left join public.chat_connections c on c.user_low=least(actor,p.id) and c.user_high=greatest(actor,p.id)
 where p.id=target_user_id and not exists(select 1 from public.chat_user_blocks b where b.blocker_id=p.id and b.blocked_id=actor);
end;$$;

create function public.get_chat_connections(list_kind text, after_user_id uuid default null)
returns table(id uuid,username text,display_name text,bio text,avatar_url text,profile_frame text)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 if list_kind is null or list_kind not in ('friends','incoming','outgoing') then raise exception 'Unknown connections list';end if;
 return query select p.id,p.username,p.display_name,p.bio,p.avatar_url,p.profile_frame
 from public.chat_connections c join public.profiles p on p.id=case when c.user_low=actor then c.user_high else c.user_low end
 where actor in(c.user_low,c.user_high) and (after_user_id is null or p.id>after_user_id)
 and case list_kind when 'friends' then c.state='accepted' when 'incoming' then c.state='pending' and c.requester_id<>actor else c.state='pending' and c.requester_id=actor end
 and not exists(select 1 from public.chat_user_blocks b where (b.blocker_id=actor and b.blocked_id=p.id) or(b.blocker_id=p.id and b.blocked_id=actor))
 order by p.id limit 50;
end;$$;
revoke all on function public.change_chat_connection(uuid,text),public.get_chat_person(uuid),public.get_chat_connections(text,uuid) from public,anon;
grant execute on function public.change_chat_connection(uuid,text),public.get_chat_person(uuid),public.get_chat_connections(text,uuid) to authenticated;
