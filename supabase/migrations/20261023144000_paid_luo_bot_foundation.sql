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
