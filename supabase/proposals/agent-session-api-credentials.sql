-- Staging only. Short-lived one-session-scoped agent keys; all functions service_role only.
begin;
alter table luo_billing.agent_api_keys add column session_generation bigint not null default 0;
create index on luo_billing.agent_api_keys(agent_id) where revoked_at is null;
create function public.luo_agent_issue_api_key(
 p_agent uuid,p_hash bytea,p_prefix text,p_scopes text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_expiry timestamptz;v_generation bigint;v_id uuid;
begin
 if p_hash is null or octet_length(p_hash)<>32 or p_prefix is null
    or p_prefix !~ '^[a-zA-Z0-9_-]{6,24}$'
    or p_scopes is null or cardinality(p_scopes) < 1 or cardinality(p_scopes)>6
    or exists(select 1 from unnest(p_scopes) x
      where x not in ('profile:read','usage:read','chat:read','chat:write','posts:read','posts:write'))
    or not public.luo_agent_has_active_entitlement(p_agent)
 then raise exception 'Key scope or membership unavailable' using errcode='28000';end if;
 select generation,expires_at into v_generation,v_expiry
 from luo_billing.agent_session_leases where agent_id=p_agent and expires_at>now()
 for update;
 if v_generation is null then raise exception 'Active agent session required' using errcode='28000';end if;
 insert into luo_billing.agent_api_keys(
 agent_id,key_prefix,token_hash,scopes,session_generation,expires_at
 ) values(p_agent,p_prefix,p_hash,p_scopes,v_generation,least(v_expiry,now()+interval '1 hour'))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.luo_agent_issue_api_key(uuid,bytea,text,text[]) from public,anon,authenticated;
grant execute on function public.luo_agent_issue_api_key(uuid,bytea,text,text[]) to service_role;

create function public.luo_agent_resolve_api_key(p_hash bytea,p_scope text)
returns table(agent_id uuid,plan text)
language sql stable security definer set search_path='' as $$
 select k.agent_id,s.plan
 from luo_billing.agent_api_keys k
 join luo_billing.agent_session_leases l
   on l.agent_id=k.agent_id and l.generation=k.session_generation
 join luo_billing.agent_accounts a on a.id=k.agent_id
 join luo_billing.billing_subscriptions s on s.agent_id=k.agent_id
 where k.token_hash=p_hash and k.revoked_at is null and k.expires_at>now()
   and l.expires_at>now() and p_scope=any(k.scopes)
   and a.state='active' and s.status='active' and s.paid_through>now()
 order by s.provider_synced_at desc limit 1;
$$;
revoke all on function public.luo_agent_resolve_api_key(bytea,text) from public,anon,authenticated;
grant execute on function public.luo_agent_resolve_api_key(bytea,text) to service_role;
commit;
