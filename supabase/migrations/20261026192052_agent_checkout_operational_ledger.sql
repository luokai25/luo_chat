-- Private checkout observability; no usernames, passwords, IPs or payment credentials.
-- Immutable provider/create/paid state transitions and aggregate service diagnostics.
begin;
create table if not exists luo_billing.checkout_state_events(
 id bigint generated always as identity primary key,
 intent_id uuid not null references luo_billing.agent_checkout_intents(id) on delete restrict,
 kind text not null check(kind in ('reserved','creation_claimed','provider_reference_bound','paid','canceled','expired')),
 happened_at timestamptz not null default now()
);
alter table luo_billing.checkout_state_events enable row level security;
revoke all on luo_billing.checkout_state_events from public,anon,authenticated;
create index if not exists luo_checkout_events_recent_idx
 on luo_billing.checkout_state_events(happened_at desc);
create index if not exists luo_checkout_events_intent_idx
 on luo_billing.checkout_state_events(intent_id,happened_at desc);

create or replace function luo_billing.record_checkout_state_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare change_kind text;
begin
 if TG_OP='INSERT' then change_kind:='reserved';
 elsif new.status<>old.status and new.status in ('paid','canceled','expired') then change_kind:=new.status;
 elsif old.provider_checkout_reference is null and new.provider_checkout_reference is not null then
  change_kind:='provider_reference_bound';
 elsif old.creation_claimed_at is null and new.creation_claimed_at is not null then
  change_kind:='creation_claimed';
 end if;
 if change_kind is not null then
  insert into luo_billing.checkout_state_events(intent_id,kind)
  values(new.id,change_kind);
 end if;
 return new;
end;
$$;
revoke all on function luo_billing.record_checkout_state_change() from public,anon,authenticated;
drop trigger if exists luo_checkout_observe_transitions on luo_billing.agent_checkout_intents;
create trigger luo_checkout_observe_transitions
after insert or update on luo_billing.agent_checkout_intents
for each row execute function luo_billing.record_checkout_state_change();

create or replace function public.luo_agent_checkout_operational_summary()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'generated_at',now(),
 'checkout_intents',(select count(*) from luo_billing.agent_checkout_intents),
 'awaiting_payment',(select count(*) from luo_billing.agent_checkout_intents
  where status='pending' and provider_checkout_reference is not null),
 'creation_pending',(select count(*) from luo_billing.agent_checkout_intents
  where status='pending' and creation_claimed_at is not null and provider_checkout_reference is null),
 'stuck_over_10_minutes',(select count(*) from luo_billing.agent_checkout_intents
  where status='pending' and creation_claimed_at<now()-interval '10 minutes'
  and provider_checkout_reference is null),
 'paid',(select count(*) from luo_billing.agent_checkout_intents where status='paid'),
 'events_24h',(select count(*) from luo_billing.checkout_state_events
  where happened_at>now()-interval '24 hours')
 );
$$;
revoke all on function public.luo_agent_checkout_operational_summary() from public,anon,authenticated;
grant execute on function public.luo_agent_checkout_operational_summary() to service_role;
commit;
