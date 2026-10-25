-- Isolated staging only. Server-only pending registrations.
-- Both global and per-network quota reservations use an atomic database transaction.
begin;
alter table luo_billing.agent_accounts add column requested_plan text not null default 'starter'
 check(requested_plan in ('starter','pro','max'));
create table luo_billing.agent_signup_buckets(
 day date not null, scope text not null check(scope in ('global','network','identity')),
 digest text not null check(length(digest) between 4 and 128),
 attempts integer not null check(attempts between 0 and 1000),
 primary key(day,scope,digest)
);
alter table luo_billing.agent_signup_buckets enable row level security;
revoke all on luo_billing.agent_signup_buckets from public,anon,authenticated;

create function public.luo_agent_reserve_pending_signup(p_identity_digest text,p_network_digest text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_scope text;v_digest text;v_cap integer;
begin
 if p_identity_digest !~ '^[a-f0-9]{64}$' or p_network_digest !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid registration rate-limit key' using errcode='22023';end if;
 for v_scope,v_digest,v_cap in
  select * from (values
   ('global'::text,'all'::text,30),
   ('network'::text,p_network_digest,3),
   ('identity'::text,p_identity_digest,1)
  ) as caps(scope,digest,quota)
 loop
  insert into luo_billing.agent_signup_buckets(day,scope,digest,attempts)
  values((now() at time zone 'UTC')::date,v_scope,v_digest,1)
  on conflict(day,scope,digest) do update
   set attempts=luo_billing.agent_signup_buckets.attempts+1
   where luo_billing.agent_signup_buckets.attempts<v_cap;
  if not found then raise exception 'Agent pending-signup quota exceeded' using errcode='P0001';end if;
 end loop;
 return true;
end $$;
revoke all on function public.luo_agent_reserve_pending_signup(text,text) from public,anon,authenticated;
grant execute on function public.luo_agent_reserve_pending_signup(text,text) to service_role;

create function public.luo_agent_create_pending_identity(
 p_auth_user uuid,p_username text,p_requested_plan text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_auth_user is null or not exists(select 1 from auth.users where id=p_auth_user)
    or p_username is null or p_username !~ '^[a-z][a-z0-9_]{2,23}$'
    or p_username like 'luo\\_%' escape '\\'
    or p_username in ('admin','administrator','support','system','root','luo','luochat','luo_chat','official','security','billing','moderator','chatgpt','openai','claude','anthropic','gemini','google')
    or p_requested_plan not in ('starter','pro','max') then
  raise exception 'Invalid pending agent identity' using errcode='22023';end if;
 insert into luo_billing.agent_accounts(auth_user_id,username,display_name,requested_plan,state)
 values(p_auth_user,p_username,p_username,p_requested_plan,'pending')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.luo_agent_create_pending_identity(uuid,text,text) from public,anon,authenticated;
grant execute on function public.luo_agent_create_pending_identity(uuid,text,text) to service_role;
commit;
