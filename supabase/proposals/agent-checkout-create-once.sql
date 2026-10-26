-- Checkout concurrency protection: persistent per-agent create-once claim.
-- The existing checkout intent remains unique per agent. Never recreate an
-- uncertain payment by relying on processor idempotency windows alone.
begin;
alter table luo_billing.agent_checkout_intents
 add column if not exists creation_claimed_at timestamptz,
 add column if not exists creation_claim_token uuid;
create or replace function public.luo_agent_reserve_checkout(
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
 -- Never recycle checkout IDs after a provider may have issued an approval URL.
 -- A canceled/expired/uncertain checkout requires a merchant reconciliation first.
 if found then
  if v_row.status<>'pending' or v_row.expires_at<=now()
    or v_row.provider<>p_provider or v_row.requested_plan<>p_plan
    or v_row.promo_applied<>p_promo
  then raise exception 'Existing checkout is locked; reconcile before changing it' using errcode='23505';
  end if;
 else
  insert into luo_billing.agent_checkout_intents(
   agent_id,provider,requested_plan,regular_cents,first_invoice_cents,promo_applied,expires_at)
  values(v_agent,p_provider,p_plan,v_full,v_first,p_promo,now()+interval '60 minutes')
  returning * into v_row;
 end if;
 return jsonb_build_object('intent_id',v_row.id,'agent_id',v_agent,'provider',v_row.provider,
 'plan',v_row.requested_plan,'promo',v_row.promo_applied,'regular_cents',v_row.regular_cents,
 'first_invoice_cents',v_row.first_invoice_cents,'existing_reference',v_row.provider_checkout_reference,
 'expires_at',v_row.expires_at);
end $$;

revoke all on function public.luo_agent_reserve_checkout(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.luo_agent_reserve_checkout(uuid,text,text,boolean) to service_role;

create or replace function public.luo_agent_claim_checkout_once(p_intent uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_i luo_billing.agent_checkout_intents%rowtype; v_token uuid;
begin
 if p_intent is null then raise exception 'Missing checkout' using errcode='22023';end if;
 select * into v_i from luo_billing.agent_checkout_intents where id=p_intent for update;
 if not found then raise exception 'Checkout unavailable' using errcode='28000';end if;
 if v_i.status<>'pending' then return jsonb_build_object('action','locked','state',v_i.status);end if;
 if v_i.provider_checkout_reference is not null then
  return jsonb_build_object('action','reuse','reference',v_i.provider_checkout_reference);end if;
 if v_i.creation_claimed_at is not null then
  return jsonb_build_object('action','locked','state','creation_or_reconciliation_pending');end if;
 if v_i.expires_at<=now() then
  return jsonb_build_object('action','locked','state','expired_requires_review');end if;
 v_token:=gen_random_uuid();
 update luo_billing.agent_checkout_intents
 set creation_claimed_at=now(),creation_claim_token=v_token where id=v_i.id;
 return jsonb_build_object('action','create','claim_token',v_token);
end;
$$;
revoke all on function public.luo_agent_claim_checkout_once(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_claim_checkout_once(uuid) to service_role;

-- A processor reference may be bound exactly once, by the request that
-- acquired the create-once token. Never replace it with a second subscription.
create or replace function public.luo_agent_bind_checkout_once(
 p_intent uuid,p_reference text,p_claim uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_intent is null or p_claim is null or p_reference is null
 or p_reference !~ '^[A-Za-z0-9_-]{8,200}$' then
  raise exception 'Invalid checkout binding' using errcode='22023';end if;
 update luo_billing.agent_checkout_intents
 set provider_checkout_reference=p_reference,creation_claim_token=null
 where id=p_intent and status='pending' and creation_claim_token=p_claim
 and creation_claimed_at is not null and provider_checkout_reference is null;
 get diagnostics n=row_count;
 return n=1;
end;
$$;
revoke all on function public.luo_agent_bind_checkout_once(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_bind_checkout_once(uuid,text,uuid) to service_role;

-- The previous RPC could attach an arbitrary reference without proving a
-- create claim. Deny even service_role from the insecure legacy surface.
revoke all on function public.luo_agent_attach_checkout(uuid,text) from public,anon,authenticated,service_role;

create or replace function public.luo_agent_checkout_state(
 p_auth_user uuid,p_username text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_i luo_billing.agent_checkout_intents%rowtype;
begin
 if p_auth_user is null or p_username is null then return jsonb_build_object('state','unavailable');end if;
 select i.* into v_i
 from luo_billing.agent_accounts a
 join luo_billing.agent_checkout_intents i on i.agent_id=a.id
 where a.auth_user_id=p_auth_user and a.username=p_username;
 if not found then return jsonb_build_object('state','not_started');end if;
 return jsonb_build_object(
  'state',case
   when v_i.status='paid' then 'paid'
   when v_i.status<>'pending' then 'locked_review_required'
   when v_i.provider_checkout_reference is not null then 'awaiting_payment'
   when v_i.creation_claimed_at is not null then 'creation_or_reconciliation_pending'
   when v_i.expires_at<=now() then 'locked_review_required'
   else 'ready'
  end,
  'provider',v_i.provider,'plan',v_i.requested_plan,'intent_id',v_i.id,
  'checkout_reference',v_i.provider_checkout_reference,
  'expires_at',v_i.expires_at
 );
end;
$$;
revoke all on function public.luo_agent_checkout_state(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_checkout_state(uuid,text) to service_role;
commit;
