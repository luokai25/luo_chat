-- Staging: don't allow billing on an account whose required Ed25519 proof
-- has not been bound. Only a privileged server can query this private boolean.
begin;
create or replace function public.luo_agent_verified_checkout_eligible(
 p_auth_user uuid,p_username text,p_plan text
) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from luo_billing.agent_accounts a
 where a.auth_user_id=p_auth_user and a.username=p_username
 and a.requested_plan=p_plan and a.state='pending'
 and a.verified_key_fingerprint ~ '^[a-f0-9]{64}$');
$$;
revoke all on function public.luo_agent_verified_checkout_eligible(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.luo_agent_verified_checkout_eligible(uuid,text,text) to service_role;
commit;
