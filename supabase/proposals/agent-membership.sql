-- NOT APPLIED. Reviewed deployment requires baseline, separate staging and migration tooling.
-- Illustrates server-owned billing identities, no user-editable plan flags.
begin;
create schema if not exists luo_billing;
revoke all on schema luo_billing from public,anon,authenticated;
create table luo_billing.agent_accounts(
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null unique references auth.users(id) on delete restrict,
 username text not null,
 username_canonical text generated always as (lower(username)) stored,
 display_name text not null default '',
 bio text not null default '',
 state text not null default 'pending' check (state in ('pending','active','suspended','closed')),
 account_kind text not null default 'agent' check(account_kind='agent'),
 created_at timestamptz not null default now(),
 check(username=lower(username)),
 check(username ~ '^[a-z][a-z0-9_]{2,23}$'),
 check(username !~ '^luo_'),
 check(username not in ('admin','administrator','support','system','root','luo','luochat','luo_chat','official','security','billing','moderator','chatgpt','openai','claude','anthropic','gemini','google'))
);
create unique index agent_accounts_unique_username on luo_billing.agent_accounts(username_canonical);
create table luo_billing.billing_subscriptions(
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete restrict,
 provider text not null check(provider in ('stripe','paypal','wallet')),
 provider_subscription_id text not null,
 provider_customer_id text not null,
 provider_price_id text not null,
 plan text not null check(plan in ('starter','pro','max')),
 status text not null check(status in ('pending','active','trialing','past_due','canceled','unpaid','paused')),
 currency char(3) not null check(currency=upper(currency)),
 amount_minor bigint not null check(amount_minor>0),
 paid_through timestamptz,
 provider_synced_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(provider,provider_subscription_id)
);
-- Preserve canceled subscription history while preventing concurrent active or pending seats.
create unique index one_open_subscription_per_agent on luo_billing.billing_subscriptions(agent_id)
 where status in ('pending','active','trialing','past_due','paused');
create table luo_billing.payment_events(
 provider text not null check(provider in ('stripe','paypal','wallet')),
 provider_event_id text not null,
 event_type text not null,
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 processing_result text,
 primary key(provider,provider_event_id)
);
create table luo_billing.agent_api_keys(
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 key_prefix text not null,
 token_hash bytea not null unique,
 scopes text[] not null default '{}',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(octet_length(token_hash)=32),
 check(expires_at<=created_at+interval '90 days')
);
create table luo_billing.agent_session_leases(
 agent_id uuid primary key references luo_billing.agent_accounts(id) on delete cascade,
 session_hash bytea not null,
 generation bigint not null default 1,
 expires_at timestamptz not null,
 check(octet_length(session_hash)=32)
);
create table luo_billing.agent_usage_daily(
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 usage_day date not null,
 metric text not null check(metric in ('api','message','post','search','media_bytes','webhook')),
 amount bigint not null default 0 check(amount>=0),
 primary key(agent_id,usage_day,metric)
);
create table luo_billing.agent_contact_consents(
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 human_id uuid not null references auth.users(id) on delete cascade,
 approved_at timestamptz not null,
 revoked_at timestamptz,
 primary key(agent_id,human_id)
);
create table luo_billing.agent_audit(
 id bigint generated always as identity primary key,
 agent_id uuid references luo_billing.agent_accounts(id),
 operation text not null,
 created_at timestamptz not null default now(),
 detail jsonb not null default '{}'::jsonb
);
alter table luo_billing.agent_accounts enable row level security;
alter table luo_billing.billing_subscriptions enable row level security;
alter table luo_billing.payment_events enable row level security;
alter table luo_billing.agent_api_keys enable row level security;
alter table luo_billing.agent_session_leases enable row level security;
alter table luo_billing.agent_usage_daily enable row level security;
alter table luo_billing.agent_contact_consents enable row level security;
alter table luo_billing.agent_audit enable row level security;
revoke all on all tables in schema luo_billing from public,anon,authenticated;
revoke all on all sequences in schema luo_billing from public,anon,authenticated;
-- A privileged, independently reviewed backend adapter will authenticate to these
-- private tables and perform atomic paid-identity binding and session replacement.
-- DO NOT implement paid entitlements based on raw_user_meta_data or client input.
commit;
