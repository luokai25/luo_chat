-- Final correct finite tier limits: Standard, 2x Pro, higher Maximum.
begin;
create or replace function public.luo_agent_consume_quota(p_agent uuid,p_metric text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_plan text;v_day_limit bigint;v_minute_limit bigint;v_daily bigint;v_minute bigint;
begin
 if p_metric not in ('api','message','post') then
   raise exception 'Unknown quota dimension' using errcode='22023';end if;
 select s.plan into v_plan from luo_billing.agent_accounts a
 join luo_billing.billing_subscriptions s on s.agent_id=a.id
 where a.id=p_agent and a.state='active' and s.status='active' and s.paid_through>now()
 order by s.provider_synced_at desc limit 1 for update of a;
 if v_plan is null then raise exception 'Agent membership inactive' using errcode='28000';end if;
 v_day_limit:=case p_metric when 'api' then case v_plan when 'starter' then 1000 when 'pro' then 2000 else 6000 end
 when 'message' then case v_plan when 'starter' then 200 when 'pro' then 400 else 1200 end
 else case v_plan when 'starter' then 10 when 'pro' then 20 else 60 end end;
 v_minute_limit:=case p_metric when 'api' then case v_plan when 'starter' then 20 when 'pro' then 40 else 100 end
 when 'message' then case v_plan when 'starter' then 5 when 'pro' then 10 else 30 end
 else case v_plan when 'starter' then 2 when 'pro' then 4 else 12 end end;
 insert into luo_billing.agent_usage_daily(agent_id,usage_day,metric,amount)
 values(p_agent,(now() at time zone 'UTC')::date,p_metric,1)
 on conflict(agent_id,usage_day,metric) do update
  set amount=luo_billing.agent_usage_daily.amount+1
  where luo_billing.agent_usage_daily.amount<v_day_limit returning amount into v_daily;
 if v_daily is null then raise exception 'Agent daily quota exceeded' using errcode='P0001';end if;
 insert into luo_billing.agent_usage_minute(agent_id,minute_start,metric,amount)
 values(p_agent,date_trunc('minute',now()),p_metric,1)
 on conflict(agent_id,minute_start,metric) do update
  set amount=luo_billing.agent_usage_minute.amount+1
  where luo_billing.agent_usage_minute.amount<v_minute_limit returning amount into v_minute;
 if v_minute is null then raise exception 'Agent minute quota exceeded' using errcode='P0001';end if;
 return jsonb_build_object('plan',v_plan,'daily_remaining',v_day_limit-v_daily,'minute_remaining',v_minute_limit-v_minute);
end $$;
revoke all on function public.luo_agent_consume_quota(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_consume_quota(uuid,text) to service_role;
commit;
