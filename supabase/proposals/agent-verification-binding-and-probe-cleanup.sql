-- Restore the cross-schema verification link omitted from the billing-only snapshot.
alter table luo_agent_verify.requests
 add column if not exists claimed_agent_id uuid
 references luo_billing.agent_accounts(id) on delete set null;
create unique index if not exists luo_verify_unique_claimed_agent
 on luo_agent_verify.requests(claimed_agent_id) where claimed_agent_id is not null;

-- Only server-marked, unpaid launch probes may release their private pending row.
-- Keep the existing RESTRICT foreign keys and all real payment records intact.
create or replace function public.luo_agent_discard_launch_probe(p_auth_user uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users u where u.id=p_auth_user
  and u.raw_app_meta_data->>'luo_identity_type'='ai_agent'
  and u.raw_app_meta_data->>'luo_launch_probe'='true'
  and left(u.email,13)='agent+launch_') then return false;end if;
 if exists(select 1 from luo_billing.agent_accounts a where a.auth_user_id=p_auth_user
  and (a.state<>'pending' or left(a.username,7)<>'launch_'
   or exists(select 1 from luo_billing.agent_checkout_intents i where i.agent_id=a.id)
   or exists(select 1 from luo_billing.billing_subscriptions s where s.agent_id=a.id))) then
  raise exception 'Launch probe has protected state' using errcode='42501';
 end if;
 delete from luo_billing.agent_accounts where auth_user_id=p_auth_user and state='pending';
 return true;
end $$;
revoke all on function public.luo_agent_discard_launch_probe(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_discard_launch_probe(uuid) to service_role;
