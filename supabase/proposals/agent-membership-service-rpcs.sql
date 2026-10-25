-- Luo Chat isolated staging only. All RPCs require the trusted service_role.
-- Only the server may pass reconciled processor data or a validated agent_id.
begin;
create table luo_billing.agent_usage_minute(
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 minute_start timestamptz not null,
 metric text not null check(metric in ('api','message','post')),
 amount bigint not null default 0 check(amount>=0),
 primary key(agent_id,minute_start,metric)
);
alter table luo_billing.agent_usage_minute enable row level security;
revoke all on luo_billing.agent_usage_minute from public,anon,authenticated;

create function public.luo_agent_has_active_entitlement(p_agent uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from luo_billing.agent_accounts a
  join luo_billing.billing_subscriptions s on s.agent_id=a.id
  where a.id=p_agent and a.state='active' and s.status='active'
    and s.paid_through>now()
 );
$$;
revoke all on function public.luo_agent_has_active_entitlement(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_has_active_entitlement(uuid) to service_role;

create function public.luo_agent_record_verified_payment(
 p_agent uuid,p_provider text,p_event text,p_event_type text,
 p_subscription text,p_customer text,p_price text,p_plan text,
 p_amount bigint,p_currency text,p_paid_through timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_sub uuid;
begin
 if p_agent is null or p_provider not in ('stripe','paypal','wallet')
    or p_plan not in ('starter','pro','max') or p_amount is null or p_amount<=0
    or p_paid_through is null or p_paid_through<=now()
    or p_currency !~ '^[A-Z]{3}$'
    or p_event is null or length(p_event)>200 or length(p_event)<4
    or p_event_type is null or length(p_event_type)>100
    or p_subscription is null or length(p_subscription)>200 or length(p_subscription)<4
    or p_customer is null or length(p_customer)>200 or length(p_customer)<4
    or p_price is null or length(p_price)>200 or length(p_price)<4
 then raise exception 'Invalid reconciled payment evidence' using errcode='22023';end if;
 select id into v_id from luo_billing.agent_accounts
 where id=p_agent and state in ('pending','active','suspended') for update;
 if v_id is null then raise exception 'Agent identity unavailable' using errcode='22023';end if;
 insert into luo_billing.payment_events(provider,provider_event_id,event_type)
 values(p_provider,p_event,p_event_type) on conflict do nothing;
 if not found then return 'duplicate';end if;
 insert into luo_billing.billing_subscriptions(
 agent_id,provider,provider_subscription_id,provider_customer_id,provider_price_id,
 plan,status,amount_minor,currency,paid_through,provider_synced_at
 ) values(p_agent,p_provider,p_subscription,p_customer,p_price,p_plan,'active',
 p_amount,p_currency,p_paid_through,now())
 on conflict(provider,provider_subscription_id) do update
 set plan=excluded.plan,provider_price_id=excluded.provider_price_id,
 status='active',amount_minor=excluded.amount_minor,currency=excluded.currency,
 paid_through=excluded.paid_through,provider_synced_at=now()
 where luo_billing.billing_subscriptions.agent_id=excluded.agent_id
  and luo_billing.billing_subscriptions.provider_customer_id=excluded.provider_customer_id
 returning id into v_sub;
 if v_sub is null then raise exception 'Subscription already belongs to another agent or customer' using errcode='23505';end if;
 update luo_billing.agent_accounts set state='active' where id=p_agent;
 update luo_billing.payment_events set processed_at=now(),processing_result='active'
 where provider=p_provider and provider_event_id=p_event;
 return 'active';
end $$;
revoke all on function public.luo_agent_record_verified_payment(uuid,text,text,text,text,text,text,text,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.luo_agent_record_verified_payment(uuid,text,text,text,text,text,text,text,bigint,text,timestamptz) to service_role;

create function public.luo_agent_suspend_paid_identity(
 p_provider text,p_subscription text,p_event text,p_state text
) returns text language plpgsql security definer set search_path='' as $$
declare v_agent uuid;
begin
 if p_provider not in ('stripe','paypal','wallet') or p_state not in ('past_due','canceled','unpaid','paused')
    or p_subscription is null or length(p_subscription)>200
    or p_event is null or length(p_event)>200 or length(p_event)<4 then
    raise exception 'Invalid subscription update' using errcode='22023';end if;
 insert into luo_billing.payment_events(provider,provider_event_id,event_type)
 values(p_provider,p_event,'subscription.'||p_state) on conflict do nothing;
 if not found then return 'duplicate';end if;
 select agent_id into v_agent from luo_billing.billing_subscriptions
 where provider=p_provider and provider_subscription_id=p_subscription for update;
 if v_agent is null then raise exception 'Unknown subscription' using errcode='22023';end if;
 update luo_billing.billing_subscriptions set status=p_state,provider_synced_at=now()
 where provider=p_provider and provider_subscription_id=p_subscription;
 if not exists(select 1 from luo_billing.billing_subscriptions
               where agent_id=v_agent and status='active' and paid_through>now()) then
  update luo_billing.agent_accounts set state='suspended' where id=v_agent and state='active';
  update luo_billing.agent_api_keys set revoked_at=now()
  where agent_id=v_agent and revoked_at is null;
  update luo_billing.agent_session_leases set expires_at=now() where agent_id=v_agent;
 end if;
 update luo_billing.payment_events set processed_at=now(),processing_result=p_state
 where provider=p_provider and provider_event_id=p_event;
 return p_state;
end $$;
revoke all on function public.luo_agent_suspend_paid_identity(text,text,text,text) from public,anon,authenticated;
grant execute on function public.luo_agent_suspend_paid_identity(text,text,text,text) to service_role;

create function public.luo_agent_replace_session(p_agent uuid,p_hash bytea,p_ttl integer)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_gen bigint;
begin
 if p_hash is null or octet_length(p_hash)<>32 or p_ttl not between 60 and 3600
    or not public.luo_agent_has_active_entitlement(p_agent) then
  raise exception 'Agent session not authorized' using errcode='28000';
 end if;
 insert into luo_billing.agent_session_leases(agent_id,session_hash,generation,expires_at)
 values(p_agent,p_hash,1,now()+make_interval(secs=>p_ttl))
 on conflict(agent_id) do update
 set session_hash=excluded.session_hash,generation=luo_billing.agent_session_leases.generation+1,
     expires_at=excluded.expires_at
 returning generation into v_gen;
 return v_gen;
end $$;
revoke all on function public.luo_agent_replace_session(uuid,bytea,integer) from public,anon,authenticated;
grant execute on function public.luo_agent_replace_session(uuid,bytea,integer) to service_role;

create function public.luo_agent_session_is_current(p_agent uuid,p_hash bytea,p_generation bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select public.luo_agent_has_active_entitlement(p_agent) and exists(
  select 1 from luo_billing.agent_session_leases
  where agent_id=p_agent and session_hash=p_hash and generation=p_generation
    and expires_at>now()
 );
$$;
revoke all on function public.luo_agent_session_is_current(uuid,bytea,bigint) from public,anon,authenticated;
grant execute on function public.luo_agent_session_is_current(uuid,bytea,bigint) to service_role;

create function public.luo_agent_consume_quota(p_agent uuid,p_metric text)
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
 v_day_limit:=case p_metric when 'api' then case v_plan when 'starter' then 1000 when 'pro' then 10000 else 50000 end
 when 'message' then case v_plan when 'starter' then 200 when 'pro' then 2000 else 10000 end
 else case v_plan when 'starter' then 10 when 'pro' then 50 else 200 end end;
 v_minute_limit:=case p_metric when 'api' then case v_plan when 'starter' then 20 when 'pro' then 60 else 180 end
 when 'message' then case v_plan when 'starter' then 5 when 'pro' then 20 else 60 end
 else case v_plan when 'starter' then 2 when 'pro' then 5 else 20 end end;
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
