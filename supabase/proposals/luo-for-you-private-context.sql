-- Luo For You user-private context and rate limits. Staging only until authorized luo_space exists.
-- No privileged public read, no service role in the browser. RLS is defense-in-depth.
begin;
create schema if not exists luo_recommend;
revoke all on schema luo_recommend from public,anon,authenticated;
create table if not exists luo_recommend.feedback(
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null,
 action text not null check(action in ('hide','not_interested')),
 updated_at timestamptz not null default now(),
 primary key(user_id,entry_id)
);
create index if not exists luo_recommend_feedback_recent_idx
 on luo_recommend.feedback(user_id,updated_at desc);
create table if not exists luo_recommend.served(
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null,
 served_at timestamptz not null default now(),
 primary key(user_id,entry_id)
);
create index if not exists luo_recommend_served_recent_idx
 on luo_recommend.served(user_id,served_at desc);
create table if not exists luo_recommend.quotas(
 user_id uuid not null references auth.users(id) on delete cascade,
 minute timestamptz not null,
 uses integer not null check(uses between 0 and 60),
 primary key(user_id,minute)
);
alter table luo_recommend.feedback enable row level security;
alter table luo_recommend.served enable row level security;
alter table luo_recommend.quotas enable row level security;
revoke all on all tables in schema luo_recommend from public,anon,authenticated;
revoke all on all functions in schema luo_recommend from public,anon,authenticated;

create or replace function public.luo_recommend_context()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); allowed integer; result jsonb;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 insert into luo_recommend.quotas(user_id,minute,uses)
 values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set uses=luo_recommend.quotas.uses+1
  where luo_recommend.quotas.uses<60 returning uses into allowed;
 if allowed is null then raise exception 'Recommendation quota exceeded' using errcode='P0001';end if;
 -- Expiry happens inside the requesting user's namespace only.
 delete from luo_recommend.served where user_id=actor and served_at<now()-interval '7 days';
 delete from luo_recommend.quotas where user_id=actor and minute<now()-interval '2 days';
 select jsonb_build_object(
  'served_ids',coalesce((select jsonb_agg(s.entry_id) from
   (select entry_id from luo_recommend.served where user_id=actor order by served_at desc limit 300)s),'[]'::jsonb),
  'hidden_ids',coalesce((select jsonb_agg(f.entry_id) from
   (select entry_id from luo_recommend.feedback where user_id=actor and
    (action='hide' or updated_at>now()-interval '90 days')
    order by updated_at desc limit 300)f),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.luo_recommend_context() from public,anon,authenticated;
grant execute on function public.luo_recommend_context() to authenticated;

create or replace function public.luo_recommend_mark_served(p_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();count_added integer;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 if p_ids is null or array_length(p_ids,1) is null or array_length(p_ids,1)>30
    or array_position(p_ids,null) is not null then raise exception 'Invalid recommendation items' using errcode='22023';end if;
 insert into luo_recommend.served(user_id,entry_id,served_at)
 select actor,i,now() from (select distinct unnest(p_ids) as i)t
 on conflict(user_id,entry_id) do update set served_at=excluded.served_at;
 get diagnostics count_added=row_count;
 return count_added;
end;
$$;
revoke all on function public.luo_recommend_mark_served(uuid[]) from public,anon,authenticated;
grant execute on function public.luo_recommend_mark_served(uuid[]) to authenticated;

create or replace function public.luo_recommend_feedback(p_entry uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();used integer;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 if p_entry is null or p_action not in ('hide','not_interested','unhide') then
  raise exception 'Invalid recommendation feedback' using errcode='22023';end if;
 insert into luo_recommend.quotas(user_id,minute,uses) values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set uses=luo_recommend.quotas.uses+1
 where luo_recommend.quotas.uses<60 returning uses into used;
 if used is null then raise exception 'Recommendation quota exceeded' using errcode='P0001';end if;
 if p_action='unhide' then delete from luo_recommend.feedback where user_id=actor and entry_id=p_entry;
 else insert into luo_recommend.feedback(user_id,entry_id,action,updated_at) values(actor,p_entry,p_action,now())
  on conflict(user_id,entry_id) do update set action=excluded.action,updated_at=now();
 end if;
 return true;
end;
$$;
revoke all on function public.luo_recommend_feedback(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_recommend_feedback(uuid,text) to authenticated;
commit;
