-- Staging only: checkout intents are bound to an authenticated PENDING agent.
-- This schema cannot charge a customer. Every mutation is service-role-only.
begin;
create table luo_billing.agent_checkout_intents(
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null unique references luo_billing.agent_accounts(id) on delete restrict,
 provider text not null check(provider in ('stripe','paypal')),
 provider_checkout_reference text unique,
 requested_plan text not null check(requested_plan in ('starter','pro','max')),
 currency text not null default 'USD' check(currency='USD'),
 regular_cents integer not null check(regular_cents>0),
 first_invoice_cents integer not null check(first_invoice_cents>0),
 promo_applied boolean not null default false,
 status text not null default 'pending' check(status in ('pending','paid','expired','canceled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 processed_at timestamptz,
 check(first_invoice_cents<=regular_cents)
);
alter table luo_billing.agent_checkout_intents enable row level security;
revoke all on luo_billing.agent_checkout_intents from public,anon,authenticated;
create function public.luo_agent_reserve_checkout(
 p_auth_user uuid,p_plan text,p_provider text,p_promo boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_agent uuid;v_row luo_billing.agent_checkout_intents%rowtype;
declare v_full integer;v_first integer;
begin
 if p_auth_user is null or p_provider not in ('stripe','paypal')
    or p_plan not in ('starter','pro','max') or p_promo is null then
  raise exception 'Invalid checkout request' using errcode='22023';end if;
 select id into v_agent from luo_billing.agent_accounts
 where auth_user_id=p_auth_user and requested_plan=p_plan and state='pending' for update;
 if v_agent is null then raise exception 'No eligible pending agent' using errcode='28000';end if;
 if exists(select 1 from luo_billing.billing_subscriptions where agent_id=v_agent and status in ('pending','active','past_due','paused','trialing'))then
  raise exception 'Agent seat already has a subscription' using errcode='23505';end if;
 v_full:=case p_plan when 'starter' then 1200 when 'pro' then 2400 else 3000 end;
 v_first:=case when not p_promo then v_full when p_plan='starter' then 300 when p_plan='pro' then 600 else 900 end;
 select * into v_row from luo_billing.agent_checkout_intents where agent_id=v_agent for update;
 if found and v_row.status='pending' and v_row.expires_at>now() then
  if v_row.provider<>p_provider or v_row.requested_plan<>p_plan or v_row.promo_applied<>p_promo then
   raise exception 'Active checkout already exists for agent' using errcode='23505';end if;
 else
  if found and v_row.status='paid' then raise exception 'Previous checkout already consumed' using errcode='23505';end if;
  insert into luo_billing.agent_checkout_intents(agent_id,provider,requested_plan,regular_cents,first_invoice_cents,promo_applied,expires_at)
  values(v_agent,p_provider,p_plan,v_full,v_first,p_promo,now()+interval '60 minutes')
  on conflict(agent_id) do update
  set id=gen_random_uuid(),provider=excluded.provider,requested_plan=excluded.requested_plan,
      regular_cents=excluded.regular_cents,first_invoice_cents=excluded.first_invoice_cents,
      promo_applied=excluded.promo_applied,status='pending',created_at=now(),
      expires_at=excluded.expires_at,provider_checkout_reference=null,processed_at=null
  returning * into v_row;
 end if;
 return jsonb_build_object('intent_id',v_row.id,'agent_id',v_agent,'provider',v_row.provider,
 'plan',v_row.requested_plan,'promo',v_row.promo_applied,'regular_cents',v_row.regular_cents,
 'first_invoice_cents',v_row.first_invoice_cents,'existing_reference',v_row.provider_checkout_reference,
 'expires_at',v_row.expires_at);
end $$;
revoke all on function public.luo_agent_reserve_checkout(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.luo_agent_reserve_checkout(uuid,text,text,boolean) to service_role;

create function public.luo_agent_attach_checkout(p_intent uuid,p_reference text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_changed integer;
begin
 if p_intent is null or p_reference is null or p_reference !~ '^[A-Za-z0-9_-]{8,200}$' then
  raise exception 'Invalid checkout reference' using errcode='22023';end if;
 update luo_billing.agent_checkout_intents
 set provider_checkout_reference=p_reference
 where id=p_intent and status='pending' and expires_at>now()
 and (provider_checkout_reference is null or provider_checkout_reference=p_reference);
 get diagnostics v_changed=row_count;
 return v_changed=1;
end $$;
revoke all on function public.luo_agent_attach_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_attach_checkout(uuid,text) to service_role;

create function public.luo_agent_checkout_snapshot(p_intent uuid,p_provider text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'agent_id',i.agent_id,'provider',i.provider,
 'reference',i.provider_checkout_reference,'plan',i.requested_plan,
 'regular_cents',i.regular_cents,'first_invoice_cents',i.first_invoice_cents,
 'promo',i.promo_applied,'status',i.status,'expires_at',i.expires_at)
 from luo_billing.agent_checkout_intents i
 where i.id=p_intent and i.provider=p_provider;
$$;
revoke all on function public.luo_agent_checkout_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_checkout_snapshot(uuid,text) to service_role;

create function public.luo_agent_record_reconciled_checkout(
 p_intent uuid,p_provider text,p_reference text,p_event text,p_event_type text,
 p_subscription text,p_customer text,p_price text,
 p_amount bigint,p_paid_through timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare v_i luo_billing.agent_checkout_intents%rowtype;v_result text;
begin
 select * into v_i from luo_billing.agent_checkout_intents
 where id=p_intent and provider=p_provider and provider_checkout_reference=p_reference for update;
 if not found or v_i.status='expired' or v_i.status='canceled' then
  raise exception 'Checkout evidence not bound to registered identity' using errcode='28000';end if;
 if p_amount not in (v_i.first_invoice_cents,v_i.regular_cents) or p_paid_through<=now() then
  raise exception 'Paid amount or period mismatch' using errcode='22023';end if;
 v_result:=public.luo_agent_record_verified_payment(v_i.agent_id,p_provider,p_event,p_event_type,
 p_subscription,p_customer,p_price,v_i.requested_plan,p_amount,'USD',p_paid_through);
 if v_result='active' then
  update luo_billing.agent_checkout_intents set status='paid',processed_at=now() where id=p_intent;
 end if;
 return v_result;
end $$;
revoke all on function public.luo_agent_record_reconciled_checkout(uuid,text,text,text,text,text,text,text,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.luo_agent_record_reconciled_checkout(uuid,text,text,text,text,text,text,text,bigint,timestamptz) to service_role;
commit;