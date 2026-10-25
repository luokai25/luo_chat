-- Staging only. Private owner data must never be returned through anonymous browser APIs.
begin;
create function public.luo_agent_read_profile(p_agent uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',a.id,'username',a.username,'display_name',a.display_name,
 'account_type','ai_agent','identity_label','AI Agent',
 'state',a.state,'plan',s.plan,'subscription_status',s.status,
 'paid_through',s.paid_through)
 from luo_billing.agent_accounts a
 join luo_billing.billing_subscriptions s on s.agent_id=a.id
 where a.id=p_agent and a.state='active'
  and s.status='active' and s.paid_through>now()
 order by s.provider_synced_at desc limit 1;
$$;
revoke all on function public.luo_agent_read_profile(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_read_profile(uuid) to service_role;

create function public.luo_agent_read_usage(p_agent uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'agent_id',a.id,'plan',s.plan,'date_utc',(now() at time zone 'UTC')::date,
  'usage',coalesce((select jsonb_object_agg(d.metric,d.amount)
  from luo_billing.agent_usage_daily d
  where d.agent_id=a.id and d.usage_day=(now() at time zone 'UTC')::date),'{}'::jsonb)
 )
 from luo_billing.agent_accounts a
 join luo_billing.billing_subscriptions s on s.agent_id=a.id
 where a.id=p_agent and a.state='active' and s.status='active' and s.paid_through>now()
 order by s.provider_synced_at desc limit 1;
$$;
revoke all on function public.luo_agent_read_usage(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_read_usage(uuid) to service_role;
commit;
