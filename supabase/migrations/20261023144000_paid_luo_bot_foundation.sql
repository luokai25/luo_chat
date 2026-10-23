-- Luo Chat paid AI agents (STAGED, ADDITIVE, DISABLED by default).
-- No bot can post after this migration alone. No human auth users altered.
-- Payment / credentials / moderation must be verified by separate server code.
begin;
create schema if not exists luo_bots;
revoke all on schema luo_bots from public,anon,authenticated;
grant usage on schema luo_bots to service_role;

create table if not exists luo_bots.accounts(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 bot_user_id uuid unique references auth.users(id) on delete set null,
 username text not null unique check(username ~ '^bot_[a-z][a-z0-9_]{2,19}$'),
 tier text not null default 'agent_basic' check(tier in ('agent_basic','agent_pro')),
 payment_status text not null default 'unpaid'
  check(payment_status in ('unpaid','active','past_due','canceled','refunded','disputed')),
 moderation_status text not null default 'pending'
  check(moderation_status in ('pending','approved','blocked')),
 suspended boolean not null default true,
 paid_until timestamptz,
 scopes text[] not null default array[]::text[],
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(bot_user_id is null or bot_user_id<>owner_id),
 check(scopes <@ array['read_assigned_thread','send_reply','react','publish_public_post']::text[])
);
create index if not exists bot_accounts_owner_idx on luo_bots.accounts(owner_id);
create index if not exists bot_accounts_paid_idx on luo_bots.accounts(paid_until) where payment_status='active';

-- A generated high-entropy bot password/API secret will be stored ONLY as a
-- keyed digest here. Never issue a human Supabase Auth refresh token to a bot.
create table if not exists luo_bots.credentials(
 bot_id uuid primary key references luo_bots.accounts(id) on delete cascade,
 secret_digest text not null check(secret_digest ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null default now(),
 revoked_at timestamptz,
 rotated_at timestamptz
);
-- Human consent never comes from bot-provided metadata or AI prompts.
create table if not exists luo_bots.thread_consents(
 bot_id uuid not null references luo_bots.accounts(id) on delete cascade,
 human_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 status text not null default 'revoked' check(status in ('active','revoked')),
 granted_at timestamptz not null default now(),
 expires_at timestamptz not null,
 scopes text[] not null default array[]::text[],
 primary key(bot_id,human_id,conversation_id),
 check(scopes <@ array['read_assigned_thread','send_reply','react']::text[])
);
create index if not exists bot_thread_consents_human_idx on luo_bots.thread_consents(human_id);
create index if not exists bot_thread_consents_exp_idx on luo_bots.thread_consents(expires_at) where status='active';

-- Merchant creates an order first. A browser redirect NEVER activates access.
-- A trusted payment webhook must verify provider signature, exact amount,
-- order, currency and transaction state, then settle idempotently.
create table if not exists luo_bots.orders(
 id uuid primary key default gen_random_uuid(),
 bot_id uuid not null references luo_bots.accounts(id) on delete cascade,
 provider text not null check(provider in ('paymob','paddle')),
 provider_order_id text not null,
 amount_minor bigint not null check(amount_minor>0),
 currency text not null check(currency in ('EGP','USD','EUR')),
 tier text not null check(tier in ('agent_basic','agent_pro')),
 state text not null default 'pending' check(state in ('pending','paid','refunded','disputed','expired')),
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 unique(provider,provider_order_id)
);
create table if not exists luo_bots.payment_events(
 provider text not null,
 event_id text not null,
 order_id uuid not null references luo_bots.orders(id),
 verified_at timestamptz not null default now(),
 outcome text not null check(outcome in ('paid','refunded','disputed')),
 amount_minor bigint not null,
 currency text not null,
 primary key(provider,event_id)
);

create table if not exists luo_bots.action_receipts(
 bot_id uuid not null references luo_bots.accounts(id) on delete cascade,
 request_id uuid not null,
 action text not null,
 target_human_id uuid,
 conversation_id uuid,
 granted_at timestamptz not null default now(),
 primary key(bot_id,request_id)
);
create index if not exists bot_receipts_time_idx on luo_bots.action_receipts(granted_at);
create table if not exists luo_bots.usage_buckets(
 bot_id uuid not null references luo_bots.accounts(id) on delete cascade,
 action text not null,
 window_type text not null check(window_type in ('minute','day','recipient_minute')),
 bucket_at timestamptz not null,
 target_key text not null default 'all',
 used integer not null default 0 check(used>=0),
 primary key(bot_id,action,window_type,bucket_at,target_key)
);
create index if not exists bot_usage_cleanup_idx on luo_bots.usage_buckets(bucket_at);
create table if not exists luo_bots.audit(
 id bigint generated always as identity primary key,
 bot_id uuid not null references luo_bots.accounts(id) on delete cascade,
 actor_id uuid,
 action text not null,
 result text not null,
 request_id uuid,
 created_at timestamptz not null default now()
);

-- Fail-closed: even paid bots need human approval, an active specific scope
-- and, for private chat operations, each human's unexpired opt-in.
create or replace function public.reserve_luo_bot_action(
 p_bot_id uuid,p_action text,p_request_id uuid,
 p_human_id uuid default null,p_conversation_id uuid default null
) returns boolean
language plpgsql security definer set search_path='' as $$
declare
 b luo_bots.accounts%rowtype;
 minute_cap integer;day_cap integer;recipient_cap integer;
 minute_used integer;day_used integer;recipient_used integer;
 minute_bucket timestamptz;day_bucket timestamptz;
begin
 if p_bot_id is null or p_request_id is null
    or p_action not in ('read_assigned_thread','send_reply','react','publish_public_post')
 then return false;end if;
 -- No RLS or public client may self-authorize bots, ever.
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
 then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('luobot:'||p_bot_id::text,0));
 select * into b from luo_bots.accounts where id=p_bot_id;
 if not found or b.payment_status<>'active'
    or b.moderation_status<>'approved' or b.suspended
    or b.bot_user_id is null or b.paid_until is null or b.paid_until<=now()
    or not (p_action=any(b.scopes))
 then return false;end if;
 if exists(select 1 from luo_bots.action_receipts
           where bot_id=p_bot_id and request_id=p_request_id)
 then return false;end if;
 if p_action='read_assigned_thread' then minute_cap:=30;day_cap:=600;recipient_cap:=15;
 elsif p_action='send_reply' then minute_cap:=6;day_cap:=180;recipient_cap:=2;
 elsif p_action='react' then minute_cap:=12;day_cap:=250;recipient_cap:=4;
 else minute_cap:=2;day_cap:=12;recipient_cap:=0;end if;
 if recipient_cap>0 then
  if p_human_id is null or p_conversation_id is null
    or not exists(
      select 1 from luo_bots.thread_consents c
      where c.bot_id=p_bot_id and c.human_id=p_human_id
        and c.conversation_id=p_conversation_id
        and c.status='active' and c.expires_at>now()
        and p_action=any(c.scopes))
  then return false;end if;
  -- The private thread may not be used to read uninvolved users.
  if (select count(*) from public.conversation_members m
      where m.conversation_id=p_conversation_id) <> 2
    or not exists(select 1 from public.conversation_members m
      where m.conversation_id=p_conversation_id and m.user_id=p_human_id)
    or not exists(select 1 from public.conversation_members m
      where m.conversation_id=p_conversation_id and m.user_id=b.bot_user_id)
  then return false;end if;
 else
  -- Public posting must never smuggle a target/cold DM.
  if p_human_id is not null or p_conversation_id is not null then return false;end if;
 end if;
 minute_bucket:=date_trunc('minute',now());
 day_bucket:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 select coalesce(sum(used),0) into minute_used from luo_bots.usage_buckets
 where bot_id=p_bot_id and action=p_action and window_type='minute' and bucket_at=minute_bucket;
 select coalesce(sum(used),0) into day_used from luo_bots.usage_buckets
 where bot_id=p_bot_id and action=p_action and window_type='day' and bucket_at=day_bucket;
 if minute_used>=minute_cap or day_used>=day_cap then return false;end if;
 if recipient_cap>0 then
  select coalesce(sum(used),0) into recipient_used from luo_bots.usage_buckets
  where bot_id=p_bot_id and action=p_action and window_type='recipient_minute'
    and bucket_at=minute_bucket and target_key=p_human_id::text;
  if recipient_used>=recipient_cap then return false;end if;
 end if;
 insert into luo_bots.action_receipts(bot_id,request_id,action,target_human_id,conversation_id)
 values(p_bot_id,p_request_id,p_action,p_human_id,p_conversation_id);
 insert into luo_bots.usage_buckets(bot_id,action,window_type,bucket_at,target_key,used)
 values(p_bot_id,p_action,'minute',minute_bucket,'all',1),
       (p_bot_id,p_action,'day',day_bucket,'all',1)
 on conflict(bot_id,action,window_type,bucket_at,target_key)
 do update set used=luo_bots.usage_buckets.used+1;
 if recipient_cap>0 then
  insert into luo_bots.usage_buckets(bot_id,action,window_type,bucket_at,target_key,used)
  values(p_bot_id,p_action,'recipient_minute',minute_bucket,p_human_id::text,1)
  on conflict(bot_id,action,window_type,bucket_at,target_key)
  do update set used=luo_bots.usage_buckets.used+1;
 end if;
 insert into luo_bots.audit(bot_id,action,result,request_id)
 values(p_bot_id,p_action,'authorized',p_request_id);
 return true;
end;$$;
revoke all on function public.reserve_luo_bot_action(uuid,text,uuid,uuid,uuid)
from public,anon,authenticated;
grant execute on function public.reserve_luo_bot_action(uuid,text,uuid,uuid,uuid) to service_role;

create or replace function public.pause_own_luo_bot(p_bot_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 if auth.uid() is null then return false;end if;
 select owner_id into owner from luo_bots.accounts where id=p_bot_id;
 if owner is distinct from auth.uid() then return false;end if;
 update luo_bots.accounts set suspended=true,updated_at=now()
 where id=p_bot_id;
 update luo_bots.credentials set revoked_at=now() where bot_id=p_bot_id;
 insert into luo_bots.audit(bot_id,actor_id,action,result)
 values(p_bot_id,auth.uid(),'owner_pause','paused');
 return true;
end;$$;
revoke all on function public.pause_own_luo_bot(uuid) from public,anon;
grant execute on function public.pause_own_luo_bot(uuid) to authenticated;

-- Extra merchant order information is server-selected, never from a checkout
-- redirect or a bot. Settlement requires signed provider callbacks.
alter table luo_bots.orders
 add column if not exists period_days integer not null default 30
 check(period_days between 1 and 365);

-- Webhook adapter validates signature *before* calling this. This RPC checks
-- a matching pending order and deduplicates signed transaction IDs.
create or replace function public.settle_luo_bot_payment(
 p_provider text,p_event_id text,p_provider_order_id text,
 p_amount_minor bigint,p_currency text,p_outcome text
) returns boolean language plpgsql security definer set search_path='' as $$
declare o luo_bots.orders%rowtype;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
  or p_provider not in ('paymob','paddle')
  or p_outcome not in ('paid','refunded','disputed')
  or p_event_id is null or length(p_event_id) not between 8 and 128
  or p_provider_order_id is null or length(p_provider_order_id) not between 1 and 128
  or p_amount_minor is null or p_amount_minor<=0
  or p_currency not in ('EGP','USD','EUR') then return false;end if;
 select * into o from luo_bots.orders
 where provider=p_provider and provider_order_id=p_provider_order_id for update;
 if not found or o.amount_minor<>p_amount_minor or o.currency<>p_currency
 then return false;end if;
 if exists(select 1 from luo_bots.payment_events
  where provider=p_provider and event_id=p_event_id) then return false;end if;
 if p_outcome='paid' and o.state<>'pending' then return false;end if;
 if p_outcome in ('refunded','disputed') and o.state<>'paid' then return false;end if;
 insert into luo_bots.payment_events(provider,event_id,order_id,outcome,amount_minor,currency)
 values(p_provider,p_event_id,o.id,p_outcome,p_amount_minor,p_currency);
 if p_outcome='paid' then
  update luo_bots.orders set state='paid',settled_at=now() where id=o.id;
  update luo_bots.accounts set payment_status='active',
   paid_until=greatest(now(),coalesce(paid_until,now()))+
    make_interval(days=>o.period_days),updated_at=now()
  where id=o.bot_id and payment_status not in ('refunded','disputed');
 else
  update luo_bots.orders set state=p_outcome where id=o.id;
  update luo_bots.accounts set payment_status=p_outcome,
   suspended=true,updated_at=now() where id=o.bot_id;
  update luo_bots.credentials set revoked_at=now() where bot_id=o.bot_id;
 end if;
 insert into luo_bots.audit(bot_id,action,result)
 values(o.bot_id,'payment_'||p_outcome,'verified_webhook');
 return true;
end;$$;
revoke all on function public.settle_luo_bot_payment(text,text,text,bigint,text,text)
 from public,anon,authenticated;
grant execute on function public.settle_luo_bot_payment(text,text,text,bigint,text,text)
 to service_role;

-- Rate limiting for failed bot authentication. Do not store raw IP/usernames.
create table if not exists luo_bots.login_attempts(
 username_digest text not null check(username_digest ~ '^[a-f0-9]{64}$'),
 ip_digest text not null check(ip_digest ~ '^[a-f0-9]{64}$'),
 attempted_at timestamptz not null default now()
);
create index if not exists bot_login_by_name_idx on luo_bots.login_attempts(username_digest,attempted_at);
create index if not exists bot_login_by_ip_idx on luo_bots.login_attempts(ip_digest,attempted_at);
create or replace function public.consume_luo_bot_login_limit(
 p_username_digest text,p_ip_digest text
) returns boolean language plpgsql security definer set search_path='' as $$
declare name_attempts integer;ip_attempts integer;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
  or p_username_digest !~ '^[a-f0-9]{64}$'
  or p_ip_digest !~ '^[a-f0-9]{64}$' then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('bot-login:'||p_username_digest,0));
 perform pg_advisory_xact_lock(hashtextextended('bot-ip:'||p_ip_digest,0));
 select count(*) into name_attempts from luo_bots.login_attempts
 where username_digest=p_username_digest and attempted_at>now()-interval '15 minutes';
 select count(*) into ip_attempts from luo_bots.login_attempts
 where ip_digest=p_ip_digest and attempted_at>now()-interval '15 minutes';
 if name_attempts>=8 or ip_attempts>=120 then return false;end if;
 insert into luo_bots.login_attempts(username_digest,ip_digest)
 values(p_username_digest,p_ip_digest);
 return true;
end;$$;
revoke all on function public.consume_luo_bot_login_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_luo_bot_login_limit(text,text) to service_role;

-- Owner-submitted applications are disabled until verified payment and review.
create or replace function public.request_luo_bot_account(
 p_owner_id uuid,p_username text
) returns uuid language plpgsql security definer set search_path='' as $$
declare count_all integer;count_pending integer;new_id uuid;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
  or p_owner_id is null or p_username !~ '^bot_[a-z][a-z0-9_]{2,19}$'
 then return null;end if;
 if not exists(select 1 from auth.users u where u.id=p_owner_id
  and coalesce(u.raw_app_meta_data->>'luo_account_type','human')<>'bot')
 then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('bot-owner:'||p_owner_id::text,0));
 select count(*) into count_all from luo_bots.accounts where owner_id=p_owner_id;
 select count(*) into count_pending from luo_bots.accounts
 where owner_id=p_owner_id and payment_status='unpaid';
 if count_all>=5 or count_pending>=2 then return null;end if;
 if exists(select 1 from public.profiles where lower(username)=p_username)
  or exists(select 1 from luo_bots.accounts where username=p_username)
 then return null;end if;
 insert into luo_bots.accounts(owner_id,username) values(p_owner_id,p_username)
 returning id into new_id;
 insert into luo_bots.audit(bot_id,actor_id,action,result)
 values(new_id,p_owner_id,'application','pending_payment');
 return new_id;
end;$$;
revoke all on function public.request_luo_bot_account(uuid,text) from public,anon,authenticated;
grant execute on function public.request_luo_bot_account(uuid,text) to service_role;

create or replace function public.get_luo_bot_gateway_credential(p_username text)
returns table(bot_id uuid,secret_digest text)
language sql stable security definer set search_path='' as $$
 select a.id,c.secret_digest from luo_bots.accounts a
 join luo_bots.credentials c on c.bot_id=a.id
 where a.username=p_username and c.revoked_at is null
  and a.payment_status='active' and a.moderation_status='approved'
  and a.suspended=false and a.bot_user_id is not null and a.paid_until>now()
  and exists(select 1 from auth.users u where u.id=a.bot_user_id
   and u.raw_app_meta_data->>'luo_account_type'='bot')
$$;
revoke all on function public.get_luo_bot_gateway_credential(text) from public,anon,authenticated;
grant execute on function public.get_luo_bot_gateway_credential(text) to service_role;

-- Owner key rotation requires server-enforced paid approval.
create or replace function public.activate_luo_bot_credential(
 p_owner_id uuid,p_bot_id uuid,p_secret_digest text
) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
  or p_owner_id is null or p_bot_id is null
  or p_secret_digest !~ '^[a-f0-9]{64}$' then return false;end if;
 update luo_bots.accounts a set suspended=false,updated_at=now()
 where a.id=p_bot_id and a.owner_id=p_owner_id
  and a.payment_status='active' and a.moderation_status='approved'
  and a.paid_until>now() and a.bot_user_id is not null
  and cardinality(a.scopes)>0
  and exists(select 1 from auth.users u where u.id=a.bot_user_id
   and u.raw_app_meta_data->>'luo_account_type'='bot');
 get diagnostics n=row_count;
 if n<>1 then return false;end if;
 insert into luo_bots.credentials(bot_id,secret_digest,issued_at,revoked_at,rotated_at)
 values(p_bot_id,p_secret_digest,now(),null,now())
 on conflict(bot_id) do update set
 secret_digest=excluded.secret_digest,issued_at=now(),revoked_at=null,rotated_at=now();
 insert into luo_bots.audit(bot_id,actor_id,action,result)
 values(p_bot_id,p_owner_id,'credentials_rotated','active');
 return true;
end;$$;
revoke all on function public.activate_luo_bot_credential(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.activate_luo_bot_credential(uuid,uuid,text) to service_role;

-- Private schema objects NEVER become Data API human client tables.
do $$declare t regclass;begin
 for t in select c.oid::regclass
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='luo_bots' and c.relkind in ('r','p')
 loop
  execute format('alter table %s enable row level security',t);
  execute format('revoke all on table %s from public,anon,authenticated',t);
  execute format('grant all on table %s to service_role',t);
 end loop;
end$$;
grant usage,select on all sequences in schema luo_bots to service_role;
revoke all on all sequences in schema luo_bots from public,anon,authenticated;
commit;
