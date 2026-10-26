-- Staging-only proposal: consume verified Ed25519 proof atomically with agent registration.
-- Apply to isolated staging after reviewing the existing luo_agent_verify and luo_billing schemas.
-- Production is not touched by this proposal.
begin;
alter table luo_billing.agent_accounts
  add column if not exists verified_key_fingerprint text;
create unique index if not exists luo_agents_unique_verified_key
  on luo_billing.agent_accounts(verified_key_fingerprint)
  where verified_key_fingerprint is not null;
alter table luo_agent_verify.requests
  add column if not exists claimed_agent_id uuid
  references luo_billing.agent_accounts(id) on delete set null;
create unique index if not exists luo_verify_unique_claimed_agent
  on luo_agent_verify.requests(claimed_agent_id) where claimed_agent_id is not null;

create or replace function public.luo_agent_create_verified_pending_identity(
 p_auth_user uuid,p_username text,p_requested_plan text,p_verification uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_fingerprint text;v_agent uuid;
begin
 if p_verification is null then raise exception 'Agent key proof is required' using errcode='28000';end if;
 select r.key_fingerprint into v_fingerprint
 from luo_agent_verify.requests r
 where r.id=p_verification and r.username=p_username and r.state='verified'
 and r.verified_until>now() and r.claimed_agent_id is null
 for update;
 if not found or v_fingerprint !~ '^[a-f0-9]{64}$'
 then raise exception 'Verified key does not match username or is already claimed' using errcode='28000';end if;
 -- Delegates exact username/plan/auth validation to the existing service-only function.
 v_agent:=public.luo_agent_create_pending_identity(p_auth_user,p_username,p_requested_plan);
 update luo_billing.agent_accounts a
 set verified_key_fingerprint=v_fingerprint where a.id=v_agent;
 update luo_agent_verify.requests r set claimed_agent_id=v_agent
 where r.id=p_verification and r.claimed_agent_id is null;
 if not found then raise exception 'Key proof was already consumed' using errcode='23505';end if;
 return v_agent;
end;
$$;
revoke all on function public.luo_agent_create_verified_pending_identity(uuid,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.luo_agent_create_verified_pending_identity(uuid,text,text,uuid) to service_role;
-- Login must also enforce a bound Ed25519 identity when proof mode is required.
create or replace function public.luo_agent_find_verified_paid_identity(p_auth_user uuid,p_username text)
returns uuid language sql stable security definer set search_path='' as $$
 select a.id from luo_billing.agent_accounts a
 where a.auth_user_id=p_auth_user and a.username=p_username
 and a.verified_key_fingerprint is not null
 and a.state='active' and public.luo_agent_has_active_entitlement(a.id)
 limit 1;
$$;
revoke all on function public.luo_agent_find_verified_paid_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_find_verified_paid_identity(uuid,text) to service_role;
commit;
