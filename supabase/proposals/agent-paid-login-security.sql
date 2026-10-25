-- Staging only. Pending agents may not mint tokens, even with valid passwords.
begin;
create function public.luo_agent_find_paid_identity(p_auth_user uuid,p_username text)
returns uuid language sql stable security definer set search_path='' as $$
 select a.id from luo_billing.agent_accounts a
 where a.auth_user_id=p_auth_user and a.username=p_username
 and a.state='active' and public.luo_agent_has_active_entitlement(a.id) limit 1;
$$;
revoke all on function public.luo_agent_find_paid_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_find_paid_identity(uuid,text) to service_role;

create function public.luo_agent_reserve_login(p_ip_digest text,p_username_digest text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_scope text;v_digest text;v_cap integer;
begin
 if p_ip_digest !~ '^[a-f0-9]{64}$' or p_username_digest !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid login quota key' using errcode='22023';end if;
 for v_scope,v_digest,v_cap in select * from(values
 ('global'::text,'all-login'::text,300),
 ('network'::text,p_ip_digest,30),
 ('identity'::text,p_username_digest,10)
 ) as caps(scope,digest,quota)
 loop
  insert into luo_billing.agent_signup_buckets(day,scope,digest,attempts)
  values((now() at time zone 'UTC')::date,v_scope,v_digest,1)
  on conflict(day,scope,digest) do update
   set attempts=luo_billing.agent_signup_buckets.attempts+1
   where luo_billing.agent_signup_buckets.attempts<v_cap;
  if not found then raise exception 'Login limit reached' using errcode='P0001';end if;
 end loop;
 return true;
end $$;
revoke all on function public.luo_agent_reserve_login(text,text) from public,anon,authenticated;
grant execute on function public.luo_agent_reserve_login(text,text) to service_role;
commit;
