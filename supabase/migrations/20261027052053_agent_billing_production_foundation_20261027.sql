-- Production-first schema rehearsal from 2026-10-27 isolated agent staging catalog.
-- No data copied; all agent tables service-role-only, RLS enforced, billing still disabled by env flags.
begin;
create schema if not exists luo_billing;
revoke all on schema luo_billing from public,anon,authenticated;
grant usage on schema luo_billing to service_role;
create table luo_billing."agent_accounts"(
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"auth_user_id" uuid NOT NULL,
"username" text NOT NULL,
"username_canonical" text GENERATED ALWAYS AS (lower(username)) STORED,
"display_name" text DEFAULT ''::text NOT NULL,
"bio" text DEFAULT ''::text NOT NULL,
"state" text DEFAULT 'pending'::text NOT NULL,
"account_kind" text DEFAULT 'agent'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"requested_plan" text DEFAULT 'starter'::text NOT NULL,
"verified_key_fingerprint" text
);
alter table luo_billing."agent_accounts" enable row level security;
create table luo_billing."agent_api_keys"(
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"agent_id" uuid NOT NULL,
"key_prefix" text NOT NULL,
"token_hash" bytea NOT NULL,
"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"expires_at" timestamp with time zone NOT NULL,
"revoked_at" timestamp with time zone,
"session_generation" bigint DEFAULT 0 NOT NULL
);
alter table luo_billing."agent_api_keys" enable row level security;
create table luo_billing."agent_audit"(
"id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"agent_id" uuid,
"operation" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
alter table luo_billing."agent_audit" enable row level security;
create table luo_billing."agent_checkout_intents"(
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"agent_id" uuid NOT NULL,
"provider" text NOT NULL,
"provider_checkout_reference" text,
"requested_plan" text NOT NULL,
"currency" text DEFAULT 'USD'::text NOT NULL,
"regular_cents" integer NOT NULL,
"first_invoice_cents" integer NOT NULL,
"promo_applied" boolean DEFAULT false NOT NULL,
"status" text DEFAULT 'pending'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"expires_at" timestamp with time zone NOT NULL,
"processed_at" timestamp with time zone,
"creation_claimed_at" timestamp with time zone,
"creation_claim_token" uuid
);
alter table luo_billing."agent_checkout_intents" enable row level security;
create table luo_billing."agent_contact_consents"(
"agent_id" uuid NOT NULL,
"human_id" uuid NOT NULL,
"approved_at" timestamp with time zone NOT NULL,
"revoked_at" timestamp with time zone
);
alter table luo_billing."agent_contact_consents" enable row level security;
create table luo_billing."agent_feed_preferences"(
"agent_id" uuid NOT NULL,
"author_id" uuid NOT NULL,
"relation" text NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table luo_billing."agent_feed_preferences" enable row level security;
create table luo_billing."agent_peer_connections"(
"agent_low" uuid NOT NULL,
"agent_high" uuid NOT NULL,
"low_approved" boolean DEFAULT false NOT NULL,
"high_approved" boolean DEFAULT false NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table luo_billing."agent_peer_connections" enable row level security;
create table luo_billing."agent_peer_messages"(
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"sender" uuid NOT NULL,
"recipient" uuid NOT NULL,
"client_message_id" uuid NOT NULL,
"text_content" text NOT NULL,
"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table luo_billing."agent_peer_messages" enable row level security;
create table luo_billing."agent_public_posts"(
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"agent_id" uuid NOT NULL,
"operation_id" uuid NOT NULL,
"body" text NOT NULL,
"published" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table luo_billing."agent_public_posts" enable row level security;
create table luo_billing."agent_session_leases"(
"agent_id" uuid NOT NULL,
"session_hash" bytea NOT NULL,
"generation" bigint DEFAULT 1 NOT NULL,
"expires_at" timestamp with time zone NOT NULL
);
alter table luo_billing."agent_session_leases" enable row level security;
create table luo_billing."agent_signup_buckets"(
"day" date NOT NULL,
"scope" text NOT NULL,
"digest" text NOT NULL,
"attempts" integer NOT NULL
);
alter table luo_billing."agent_signup_buckets" enable row level security;
create table luo_billing."agent_usage_daily"(
"agent_id" uuid NOT NULL,
"usage_day" date NOT NULL,
"metric" text NOT NULL,
"amount" bigint DEFAULT 0 NOT NULL
);
alter table luo_billing."agent_usage_daily" enable row level security;
create table luo_billing."agent_usage_minute"(
"agent_id" uuid NOT NULL,
"minute_start" timestamp with time zone NOT NULL,
"metric" text NOT NULL,
"amount" bigint DEFAULT 0 NOT NULL
);
alter table luo_billing."agent_usage_minute" enable row level security;
create table luo_billing."billing_subscriptions"(
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"agent_id" uuid NOT NULL,
"provider" text NOT NULL,
"provider_subscription_id" text NOT NULL,
"provider_customer_id" text NOT NULL,
"provider_price_id" text NOT NULL,
"plan" text NOT NULL,
"status" text NOT NULL,
"currency" character(3) NOT NULL,
"amount_minor" bigint NOT NULL,
"paid_through" timestamp with time zone,
"provider_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table luo_billing."billing_subscriptions" enable row level security;
create table luo_billing."checkout_state_events"(
"id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"intent_id" uuid NOT NULL,
"kind" text NOT NULL,
"happened_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table luo_billing."checkout_state_events" enable row level security;
create table luo_billing."payment_events"(
"provider" text NOT NULL,
"provider_event_id" text NOT NULL,
"event_type" text NOT NULL,
"received_at" timestamp with time zone DEFAULT now() NOT NULL,
"processed_at" timestamp with time zone,
"processing_result" text
);
alter table luo_billing."payment_events" enable row level security;
alter table luo_billing."agent_accounts" add constraint "agent_accounts_account_kind_check" CHECK ((account_kind = 'agent'::text));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_requested_plan_check" CHECK ((requested_plan = ANY (ARRAY['starter'::text, 'pro'::text, 'max'::text])));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_state_check" CHECK ((state = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'closed'::text])));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_username_check" CHECK ((username = lower(username)));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_username_check1" CHECK ((username ~ '^[a-z][a-z0-9_]{2,23}$'::text));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_username_check2" CHECK ((username !~ '^luo_'::text));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_username_check3" CHECK ((username <> ALL (ARRAY['admin'::text, 'administrator'::text, 'support'::text, 'system'::text, 'root'::text, 'luo'::text, 'luochat'::text, 'luo_chat'::text, 'official'::text, 'security'::text, 'billing'::text, 'moderator'::text, 'chatgpt'::text, 'openai'::text, 'claude'::text, 'anthropic'::text, 'gemini'::text, 'google'::text])));
alter table luo_billing."agent_api_keys" add constraint "agent_api_keys_check" CHECK ((expires_at <= (created_at + '90 days'::interval)));
alter table luo_billing."agent_api_keys" add constraint "agent_api_keys_token_hash_check" CHECK ((octet_length(token_hash) = 32));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_check" CHECK ((first_invoice_cents <= regular_cents));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_currency_check" CHECK ((currency = 'USD'::text));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_first_invoice_cents_check" CHECK ((first_invoice_cents > 0));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_provider_check" CHECK ((provider = ANY (ARRAY['stripe'::text, 'paypal'::text])));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_regular_cents_check" CHECK ((regular_cents > 0));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_requested_plan_check" CHECK ((requested_plan = ANY (ARRAY['starter'::text, 'pro'::text, 'max'::text])));
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'canceled'::text])));
alter table luo_billing."agent_feed_preferences" add constraint "agent_feed_preferences_check" CHECK ((agent_id <> author_id));
alter table luo_billing."agent_feed_preferences" add constraint "agent_feed_preferences_relation_check" CHECK ((relation = ANY (ARRAY['follow'::text, 'mute'::text])));
alter table luo_billing."agent_peer_connections" add constraint "agent_peer_connections_check" CHECK ((agent_low < agent_high));
alter table luo_billing."agent_peer_messages" add constraint "agent_peer_messages_check" CHECK ((sender <> recipient));
alter table luo_billing."agent_peer_messages" add constraint "agent_peer_messages_text_content_check" CHECK (((length(text_content) >= 1) AND (length(text_content) <= 4000)));
alter table luo_billing."agent_public_posts" add constraint "agent_public_posts_body_check" CHECK (((length(body) >= 1) AND (length(body) <= 2000)));
alter table luo_billing."agent_session_leases" add constraint "agent_session_leases_session_hash_check" CHECK ((octet_length(session_hash) = 32));
alter table luo_billing."agent_signup_buckets" add constraint "agent_signup_buckets_attempts_check" CHECK (((attempts >= 0) AND (attempts <= 1000)));
alter table luo_billing."agent_signup_buckets" add constraint "agent_signup_buckets_digest_check" CHECK (((length(digest) >= 4) AND (length(digest) <= 128)));
alter table luo_billing."agent_signup_buckets" add constraint "agent_signup_buckets_scope_check" CHECK ((scope = ANY (ARRAY['global'::text, 'network'::text, 'identity'::text])));
alter table luo_billing."agent_usage_daily" add constraint "agent_usage_daily_amount_check" CHECK ((amount >= 0));
alter table luo_billing."agent_usage_daily" add constraint "agent_usage_daily_metric_check" CHECK ((metric = ANY (ARRAY['api'::text, 'message'::text, 'post'::text, 'search'::text, 'media_bytes'::text, 'webhook'::text])));
alter table luo_billing."agent_usage_minute" add constraint "agent_usage_minute_amount_check" CHECK ((amount >= 0));
alter table luo_billing."agent_usage_minute" add constraint "agent_usage_minute_metric_check" CHECK ((metric = ANY (ARRAY['api'::text, 'message'::text, 'post'::text])));
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_amount_minor_check" CHECK ((amount_minor > 0));
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_currency_check" CHECK (((currency)::text = upper((currency)::text)));
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_plan_check" CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'max'::text])));
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_provider_check" CHECK ((provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'wallet'::text])));
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'paused'::text])));
alter table luo_billing."checkout_state_events" add constraint "checkout_state_events_kind_check" CHECK ((kind = ANY (ARRAY['reserved'::text, 'creation_claimed'::text, 'provider_reference_bound'::text, 'paid'::text, 'canceled'::text, 'expired'::text])));
alter table luo_billing."payment_events" add constraint "payment_events_provider_check" CHECK ((provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'wallet'::text])));
alter table luo_billing."agent_accounts" add constraint "agent_accounts_pkey" PRIMARY KEY (id);
alter table luo_billing."agent_api_keys" add constraint "agent_api_keys_pkey" PRIMARY KEY (id);
alter table luo_billing."agent_audit" add constraint "agent_audit_pkey" PRIMARY KEY (id);
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_pkey" PRIMARY KEY (id);
alter table luo_billing."agent_contact_consents" add constraint "agent_contact_consents_pkey" PRIMARY KEY (agent_id, human_id);
alter table luo_billing."agent_feed_preferences" add constraint "agent_feed_preferences_pkey" PRIMARY KEY (agent_id, author_id);
alter table luo_billing."agent_peer_connections" add constraint "agent_peer_connections_pkey" PRIMARY KEY (agent_low, agent_high);
alter table luo_billing."agent_peer_messages" add constraint "agent_peer_messages_pkey" PRIMARY KEY (id);
alter table luo_billing."agent_public_posts" add constraint "agent_public_posts_pkey" PRIMARY KEY (id);
alter table luo_billing."agent_session_leases" add constraint "agent_session_leases_pkey" PRIMARY KEY (agent_id);
alter table luo_billing."agent_signup_buckets" add constraint "agent_signup_buckets_pkey" PRIMARY KEY (day, scope, digest);
alter table luo_billing."agent_usage_daily" add constraint "agent_usage_daily_pkey" PRIMARY KEY (agent_id, usage_day, metric);
alter table luo_billing."agent_usage_minute" add constraint "agent_usage_minute_pkey" PRIMARY KEY (agent_id, minute_start, metric);
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_pkey" PRIMARY KEY (id);
alter table luo_billing."checkout_state_events" add constraint "checkout_state_events_pkey" PRIMARY KEY (id);
alter table luo_billing."payment_events" add constraint "payment_events_pkey" PRIMARY KEY (provider, provider_event_id);
alter table luo_billing."agent_accounts" add constraint "agent_accounts_auth_user_id_key" UNIQUE (auth_user_id);
alter table luo_billing."agent_api_keys" add constraint "agent_api_keys_token_hash_key" UNIQUE (token_hash);
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_agent_id_key" UNIQUE (agent_id);
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_provider_checkout_reference_key" UNIQUE (provider_checkout_reference);
alter table luo_billing."agent_peer_messages" add constraint "agent_peer_messages_sender_client_message_id_key" UNIQUE (sender, client_message_id);
alter table luo_billing."agent_public_posts" add constraint "agent_public_posts_agent_id_operation_id_key" UNIQUE (agent_id, operation_id);
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_provider_provider_subscription_id_key" UNIQUE (provider, provider_subscription_id);
alter table luo_billing."agent_accounts" add constraint "agent_accounts_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table luo_billing."agent_api_keys" add constraint "agent_api_keys_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_audit" add constraint "agent_audit_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id);
alter table luo_billing."agent_checkout_intents" add constraint "agent_checkout_intents_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE RESTRICT;
alter table luo_billing."agent_contact_consents" add constraint "agent_contact_consents_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_contact_consents" add constraint "agent_contact_consents_human_id_fkey" FOREIGN KEY (human_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table luo_billing."agent_feed_preferences" add constraint "agent_feed_preferences_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_feed_preferences" add constraint "agent_feed_preferences_author_id_fkey" FOREIGN KEY (author_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_peer_connections" add constraint "agent_peer_connections_agent_high_fkey" FOREIGN KEY (agent_high) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_peer_connections" add constraint "agent_peer_connections_agent_low_fkey" FOREIGN KEY (agent_low) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_peer_messages" add constraint "agent_peer_messages_recipient_fkey" FOREIGN KEY (recipient) REFERENCES luo_billing.agent_accounts(id) ON DELETE RESTRICT;
alter table luo_billing."agent_peer_messages" add constraint "agent_peer_messages_sender_fkey" FOREIGN KEY (sender) REFERENCES luo_billing.agent_accounts(id) ON DELETE RESTRICT;
alter table luo_billing."agent_public_posts" add constraint "agent_public_posts_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_session_leases" add constraint "agent_session_leases_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_usage_daily" add constraint "agent_usage_daily_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."agent_usage_minute" add constraint "agent_usage_minute_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE CASCADE;
alter table luo_billing."billing_subscriptions" add constraint "billing_subscriptions_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES luo_billing.agent_accounts(id) ON DELETE RESTRICT;
alter table luo_billing."checkout_state_events" add constraint "checkout_state_events_intent_id_fkey" FOREIGN KEY (intent_id) REFERENCES luo_billing.agent_checkout_intents(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX agent_accounts_unique_username ON luo_billing.agent_accounts USING btree (username_canonical);
CREATE UNIQUE INDEX luo_agents_unique_verified_key ON luo_billing.agent_accounts USING btree (verified_key_fingerprint) WHERE (verified_key_fingerprint IS NOT NULL);
CREATE INDEX agent_api_keys_agent_id_idx ON luo_billing.agent_api_keys USING btree (agent_id) WHERE (revoked_at IS NULL);
CREATE INDEX agent_feed_preferences_reverse ON luo_billing.agent_feed_preferences USING btree (author_id, relation);
CREATE INDEX agent_peer_messages_sender_recipient_sent_at_idx ON luo_billing.agent_peer_messages USING btree (sender, recipient, sent_at DESC);
CREATE INDEX agent_peer_messages_recipient_sender_sent_at_idx ON luo_billing.agent_peer_messages USING btree (recipient, sender, sent_at DESC);
CREATE INDEX luo_agent_post_timeline ON luo_billing.agent_public_posts USING btree (created_at DESC, id DESC) WHERE published;
CREATE UNIQUE INDEX one_open_subscription_per_agent ON luo_billing.billing_subscriptions USING btree (agent_id) WHERE (status = ANY (ARRAY['pending'::text, 'active'::text, 'trialing'::text, 'past_due'::text, 'paused'::text]));
CREATE INDEX luo_checkout_events_recent_idx ON luo_billing.checkout_state_events USING btree (happened_at DESC);
CREATE INDEX luo_checkout_events_intent_idx ON luo_billing.checkout_state_events USING btree (intent_id, happened_at DESC);
revoke all on all tables in schema luo_billing from public,anon,authenticated;
grant all on all tables in schema luo_billing to service_role;
grant usage,select,update on all sequences in schema luo_billing to service_role;
CREATE OR REPLACE FUNCTION luo_billing.record_checkout_state_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_attach_checkout(p_intent uuid, p_reference text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_bind_checkout_once(p_intent uuid, p_reference text, p_claim uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_checkout_operational_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_checkout_snapshot(p_intent uuid, p_provider text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',i.id,'agent_id',i.agent_id,'provider',i.provider,
 'reference',i.provider_checkout_reference,'plan',i.requested_plan,
 'regular_cents',i.regular_cents,'first_invoice_cents',i.first_invoice_cents,
 'promo',i.promo_applied,'status',i.status,'expires_at',i.expires_at)
 from luo_billing.agent_checkout_intents i
 where i.id=p_intent and i.provider=p_provider;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_checkout_state(p_auth_user uuid, p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_claim_checkout_once(p_intent uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_consume_quota(p_agent uuid, p_metric text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_create_pending_identity(p_auth_user uuid, p_username text, p_requested_plan text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if p_auth_user is null or not exists(select 1 from auth.users where id=p_auth_user)
    or p_username is null or p_username !~ '^[a-z][a-z0-9_]{2,23}$'
    or p_username like 'luo\\_%' escape '\\'
    or p_username in ('admin','administrator','support','system','root','luo','luochat','luo_chat','official','security','billing','moderator','chatgpt','openai','claude','anthropic','gemini','google')
    or p_requested_plan not in ('starter','pro','max') then
  raise exception 'Invalid pending agent identity' using errcode='22023';end if;
 insert into luo_billing.agent_accounts(auth_user_id,username,display_name,requested_plan,state)
 values(p_auth_user,p_username,p_username,p_requested_plan,'pending')
 returning id into v_id;
 return v_id;
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_create_verified_pending_identity(p_auth_user uuid, p_username text, p_requested_plan text, p_verification uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_fingerprint text;v_agent uuid;
begin
 if p_verification is null then raise exception 'Agent key proof is required' using errcode='28000';end if;
 select r.key_fingerprint into v_fingerprint
 from luo_agent_verify.requests r
 where r.id=p_verification and r.username=p_username and r.state='verified'
 and r.verified_until>now() and r.claimed_agent_id is null
 for update;
 if not found or v_fingerprint !~ '^[a-f0-9]{64}$'
 then raise exception 'Verified key does not match username or is already claimed' using errcode='28000';end if;
 -- Delegates exact username/plan/auth validation to the existing service-only function.
 v_agent:=public.luo_agent_create_pending_identity(p_auth_user,p_username,p_requested_plan);
 update luo_billing.agent_accounts a
 set verified_key_fingerprint=v_fingerprint where a.id=v_agent;
 update luo_agent_verify.requests r set claimed_agent_id=v_agent
 where r.id=p_verification and r.claimed_agent_id is null;
 if not found then raise exception 'Key proof was already consumed' using errcode='23505';end if;
 return v_agent;
end;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_has_active_entitlement(p_agent uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists (
  select 1 from luo_billing.agent_accounts a
  join luo_billing.billing_subscriptions s on s.agent_id=a.id
  where a.id=p_agent and a.state='active' and s.status='active'
    and s.paid_through>now()
 );
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_approve_peer(p_actor uuid, p_other uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row luo_billing.agent_peer_connections%rowtype;v_lo uuid;v_hi uuid;
begin
 if p_actor is null or p_other is null or p_actor=p_other
 or not public.luo_agent_has_active_entitlement(p_actor)
 or not public.luo_agent_has_active_entitlement(p_other) then
 raise exception 'Agent contact not authorized' using errcode='28000';end if;
 v_lo:=least(p_actor,p_other);v_hi:=greatest(p_actor,p_other);
 insert into luo_billing.agent_peer_connections(agent_low,agent_high,low_approved,high_approved)
 values(v_lo,v_hi,p_actor=v_lo,p_actor=v_hi)
 on conflict(agent_low,agent_high) do update
 set low_approved=luo_billing.agent_peer_connections.low_approved or excluded.low_approved,
     high_approved=luo_billing.agent_peer_connections.high_approved or excluded.high_approved,
     updated_at=now()
 returning * into v_row;
 return jsonb_build_object('accepted',v_row.low_approved and v_row.high_approved,
   'peer',p_other,'identity_label','AI Agent');
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_delete_post(p_agent uuid, p_post uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if p_agent is null or p_post is null or not public.luo_agent_has_active_entitlement(p_agent)
 then raise exception 'Agent identity unavailable' using errcode='28000';end if;
 update luo_billing.agent_public_posts set published=false
 where id=p_post and agent_id=p_agent and published=true;
 get diagnostics n=row_count;
 return n>0;
end;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_find_paid_identity(p_auth_user uuid, p_username text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select a.id from luo_billing.agent_accounts a
 where a.auth_user_id=p_auth_user and a.username=p_username
 and a.state='active' and public.luo_agent_has_active_entitlement(a.id) limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_find_peer(p_actor uuid, p_username text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',b.id,'username',b.username,'identity_label','AI Agent')
 from luo_billing.agent_accounts b
 where p_username=b.username and b.id<>p_actor and b.state='active'
  and public.luo_agent_has_active_entitlement(p_actor)
  and public.luo_agent_has_active_entitlement(b.id) limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_find_verified_paid_identity(p_auth_user uuid, p_username text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select a.id from luo_billing.agent_accounts a
 where a.auth_user_id=p_auth_user and a.username=p_username
 and a.verified_key_fingerprint is not null
 and a.state='active' and public.luo_agent_has_active_entitlement(a.id)
 limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_issue_api_key(p_agent uuid, p_hash bytea, p_prefix text, p_scopes text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_expiry timestamptz;v_generation bigint;v_id uuid;
begin
 if p_hash is null or octet_length(p_hash)<>32 or p_prefix is null
    or p_prefix !~ '^[a-zA-Z0-9_-]{6,24}$'
    or p_scopes is null or cardinality(p_scopes) < 1 or cardinality(p_scopes)>6
    or exists(select 1 from unnest(p_scopes) x
      where x not in ('profile:read','usage:read','chat:read','chat:write','posts:read','posts:write'))
    or not public.luo_agent_has_active_entitlement(p_agent)
 then raise exception 'Key scope or membership unavailable' using errcode='28000';end if;
 select generation,expires_at into v_generation,v_expiry
 from luo_billing.agent_session_leases where agent_id=p_agent and expires_at>now()
 for update;
 if v_generation is null then raise exception 'Active agent session required' using errcode='28000';end if;
 insert into luo_billing.agent_api_keys(
 agent_id,key_prefix,token_hash,scopes,session_generation,expires_at
 ) values(p_agent,p_prefix,p_hash,p_scopes,v_generation,least(v_expiry,now()+interval '1 hour'))
 returning id into v_id;
 return v_id;
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_publish_post(p_agent uuid, p_operation uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare existing luo_billing.agent_public_posts%rowtype; created luo_billing.agent_public_posts%rowtype;
begin
 if p_agent is null or p_operation is null or p_body is null
 or length(btrim(p_body))<1 or length(p_body)>2000
 then raise exception 'Invalid agent post' using errcode='22023';end if;
 if not public.luo_agent_has_active_entitlement(p_agent)
 then raise exception 'Paid agent membership required' using errcode='28000';end if;
 -- Serialize one author's retries; a re-sent operation cannot consume another post quota.
 perform pg_advisory_xact_lock(hashtextextended(p_agent::text,917613));
 select * into existing from luo_billing.agent_public_posts
 where agent_id=p_agent and operation_id=p_operation;
 if found then
  if existing.body<>p_body then raise exception 'Operation id belongs to another post' using errcode='23505';end if;
  return jsonb_build_object('id',existing.id,'created_at',existing.created_at,
   'published',existing.published,'duplicate',true,'identity_label','AI Agent');
 end if;
 perform public.luo_agent_consume_quota(p_agent,'post');
 insert into luo_billing.agent_public_posts(agent_id,operation_id,body)
 values(p_agent,p_operation,p_body) returning * into created;
 return jsonb_build_object('id',created.id,'created_at',created.created_at,
  'published',true,'duplicate',false,'identity_label','AI Agent');
end;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_read_peer_messages(p_actor uuid, p_peer uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',msg.id,'sender',msg.sender,'recipient',msg.recipient,
 'text',msg.text_content,'sent_at',msg.sent_at,'identity_label','AI Agent') order by msg.sent_at desc),'[]'::jsonb)
 from(
  select m.* from luo_billing.agent_peer_messages m
  where ((m.sender=p_actor and m.recipient=p_peer) or (m.sender=p_peer and m.recipient=p_actor))
  and p_limit between 1 and 50
  and public.luo_agent_has_active_entitlement(p_actor)
  and public.luo_agent_has_active_entitlement(p_peer)
  and exists(select 1 from luo_billing.agent_peer_connections c
   where c.agent_low=least(p_actor,p_peer) and c.agent_high=greatest(p_actor,p_peer)
    and c.low_approved and c.high_approved)
  order by m.sent_at desc limit least(greatest(p_limit,1),50)
 ) msg;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_read_profile(p_agent uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_read_public_posts(p_agent uuid, p_before timestamp with time zone, p_before_id uuid, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not public.luo_agent_has_active_entitlement(p_agent) then
  raise exception 'Paid agent membership required' using errcode='28000';end if;
 if p_limit is null or p_limit<1 or p_limit>30
  or (p_before is null)<>(p_before_id is null) then
  raise exception 'Invalid feed cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id desc),'[]'::jsonb)
 into result from (
  select p.created_at,p.id,
   jsonb_build_object('id',p.id,'agent_id',p.agent_id,'username',a.username,
    'identity_label','AI Agent','body',p.body,'created_at',p.created_at,
    'viewer_follows_author',exists(
      select 1 from luo_billing.agent_feed_preferences f
      where f.agent_id=p_agent and f.author_id=p.agent_id and f.relation='follow'
    )) item
  from luo_billing.agent_public_posts p
  join luo_billing.agent_accounts a on a.id=p.agent_id and a.state='active'
  where p.published
    and exists(select 1 from luo_billing.billing_subscriptions s
      where s.agent_id=a.id and s.status='active' and s.paid_through>now())
    and not exists(
      select 1 from luo_billing.agent_feed_preferences muted
      where muted.agent_id=p_agent and muted.author_id=p.agent_id and muted.relation='mute'
    )
    and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
  order by p.created_at desc,p.id desc limit p_limit
 )x;
 return result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_read_usage(p_agent uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_record_verified_payment(p_agent uuid, p_provider text, p_event text, p_event_type text, p_subscription text, p_customer text, p_price text, p_plan text, p_amount bigint, p_currency text, p_paid_through timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_record_reconciled_checkout(p_intent uuid, p_provider text, p_reference text, p_event text, p_event_type text, p_subscription text, p_customer text, p_price text, p_amount bigint, p_paid_through timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_replace_session(p_agent uuid, p_hash bytea, p_ttl integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_reserve_checkout(p_auth_user uuid, p_plan text, p_provider text, p_promo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_reserve_login(p_ip_digest text, p_username_digest text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_scope text;v_digest text;v_cap integer;
begin
 if p_ip_digest !~ '^[a-f0-9]{64}$' or p_username_digest !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid login quota key' using errcode='22023';end if;
 for v_scope,v_digest,v_cap in select * from(values
 ('global'::text,'all-login'::text,300),
 ('network'::text,p_ip_digest,30),
 ('identity'::text,p_username_digest,10)
 ) as caps(scope,digest,quota)
 loop
  insert into luo_billing.agent_signup_buckets(day,scope,digest,attempts)
  values((now() at time zone 'UTC')::date,v_scope,v_digest,1)
  on conflict(day,scope,digest) do update
   set attempts=luo_billing.agent_signup_buckets.attempts+1
   where luo_billing.agent_signup_buckets.attempts<v_cap;
  if not found then raise exception 'Login limit reached' using errcode='P0001';end if;
 end loop;
 return true;
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_reserve_pending_signup(p_identity_digest text, p_network_digest text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_scope text;v_digest text;v_cap integer;
begin
 if p_identity_digest !~ '^[a-f0-9]{64}$' or p_network_digest !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid registration rate-limit key' using errcode='22023';end if;
 for v_scope,v_digest,v_cap in
  select * from (values
   ('global'::text,'all'::text,30),
   ('network'::text,p_network_digest,3),
   ('identity'::text,p_identity_digest,1)
  ) as caps(scope,digest,quota)
 loop
  insert into luo_billing.agent_signup_buckets(day,scope,digest,attempts)
  values((now() at time zone 'UTC')::date,v_scope,v_digest,1)
  on conflict(day,scope,digest) do update
   set attempts=luo_billing.agent_signup_buckets.attempts+1
   where luo_billing.agent_signup_buckets.attempts<v_cap;
  if not found then raise exception 'Agent pending-signup quota exceeded' using errcode='P0001';end if;
 end loop;
 return true;
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_resolve_api_key(p_hash bytea, p_scope text)
 RETURNS TABLE(agent_id uuid, plan text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select k.agent_id,s.plan
 from luo_billing.agent_api_keys k
 join luo_billing.agent_session_leases l
   on l.agent_id=k.agent_id and l.generation=k.session_generation
 join luo_billing.agent_accounts a on a.id=k.agent_id
 join luo_billing.billing_subscriptions s on s.agent_id=k.agent_id
 where k.token_hash=p_hash and k.revoked_at is null and k.expires_at>now()
   and l.expires_at>now() and p_scope=any(k.scopes)
   and a.state='active' and s.status='active' and s.paid_through>now()
 order by s.provider_synced_at desc limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_send_peer_message(p_sender uuid, p_recipient uuid, p_client_id uuid, p_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_allowed boolean;v_id uuid;v_old luo_billing.agent_peer_messages%rowtype;
begin
 if p_sender is null or p_recipient is null or p_client_id is null
 or p_sender=p_recipient or p_text is null or char_length(p_text) not between 1 and 4000
 or trim(p_text)='' or not public.luo_agent_has_active_entitlement(p_sender)
 or not public.luo_agent_has_active_entitlement(p_recipient)then
  raise exception 'Agent message disallowed' using errcode='28000';end if;
 select (low_approved and high_approved) into v_allowed
 from luo_billing.agent_peer_connections
 where agent_low=least(p_sender,p_recipient) and agent_high=greatest(p_sender,p_recipient) for update;
 if coalesce(v_allowed,false)=false then
  raise exception 'Both agents must accept contact first' using errcode='28000';end if;
 select * into v_old from luo_billing.agent_peer_messages
 where sender=p_sender and client_message_id=p_client_id;
 if found then
  if v_old.recipient<>p_recipient or v_old.text_content<>p_text then
   raise exception 'Idempotency key reused with changed message' using errcode='23505';end if;
  return jsonb_build_object('id',v_old.id,'deduplicated',true,'identity_label','AI Agent');
 end if;
 perform public.luo_agent_consume_quota(p_sender,'message');
 insert into luo_billing.agent_peer_messages(sender,recipient,client_message_id,text_content)
 values(p_sender,p_recipient,p_client_id,p_text) returning id into v_id;
 return jsonb_build_object('id',v_id,'deduplicated',false,'identity_label','AI Agent');
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_session_is_current(p_agent uuid, p_hash bytea, p_generation bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select public.luo_agent_has_active_entitlement(p_agent) and exists(
  select 1 from luo_billing.agent_session_leases
  where agent_id=p_agent and session_hash=p_hash and generation=p_generation
    and expires_at>now()
 );
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_set_feed_preference(p_agent uuid, p_author uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; current_relation text;
begin
 if p_agent is null or p_author is null or p_agent=p_author or
  p_action is null or p_action not in ('follow','mute','clear')
 then raise exception 'Invalid feed preference' using errcode='22023';end if;
 if not public.luo_agent_has_active_entitlement(p_agent) then
  raise exception 'Active agent membership required' using errcode='28000';end if;
 if not exists(
  select 1 from luo_billing.agent_accounts a
  join luo_billing.billing_subscriptions s on s.agent_id=a.id
  where a.id=p_author and a.state='active'
    and s.status='active' and s.paid_through>now()
 ) then raise exception 'Agent author unavailable' using errcode='28000';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_agent::text,917618));
 if p_action='clear' then
  delete from luo_billing.agent_feed_preferences
  where agent_id=p_agent and author_id=p_author;
  return jsonb_build_object('author_id',p_author,'relation',null);
 end if;
 select count(*) into n from luo_billing.agent_feed_preferences where agent_id=p_agent;
 if n>=300 and not exists(select 1 from luo_billing.agent_feed_preferences
    where agent_id=p_agent and author_id=p_author)
 then raise exception 'Agent preference cap reached' using errcode='P0001';end if;
 insert into luo_billing.agent_feed_preferences(agent_id,author_id,relation)
 values(p_agent,p_author,p_action)
 on conflict(agent_id,author_id) do update set relation=excluded.relation,updated_at=now();
 return jsonb_build_object('author_id',p_author,'relation',p_action);
end;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_suspend_paid_identity(p_provider text, p_subscription text, p_event text, p_state text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.luo_agent_verified_checkout_eligible(p_auth_user uuid, p_username text, p_plan text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from luo_billing.agent_accounts a
 where a.auth_user_id=p_auth_user and a.username=p_username
 and a.requested_plan=p_plan and a.state='pending'
 and a.verified_key_fingerprint ~ '^[a-f0-9]{64}$');
$function$;
CREATE TRIGGER luo_checkout_observe_transitions AFTER INSERT OR UPDATE ON luo_billing.agent_checkout_intents FOR EACH ROW EXECUTE FUNCTION luo_billing.record_checkout_state_change();
revoke all on all functions in schema luo_billing from public,anon,authenticated;
grant execute on all functions in schema luo_billing to service_role;
revoke all on function public."luo_agent_attach_checkout"(p_intent uuid, p_reference text) from public,anon,authenticated;
grant execute on function public."luo_agent_attach_checkout"(p_intent uuid, p_reference text) to service_role;
revoke all on function public."luo_agent_bind_checkout_once"(p_intent uuid, p_reference text, p_claim uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_bind_checkout_once"(p_intent uuid, p_reference text, p_claim uuid) to service_role;
revoke all on function public."luo_agent_checkout_operational_summary"() from public,anon,authenticated;
grant execute on function public."luo_agent_checkout_operational_summary"() to service_role;
revoke all on function public."luo_agent_checkout_snapshot"(p_intent uuid, p_provider text) from public,anon,authenticated;
grant execute on function public."luo_agent_checkout_snapshot"(p_intent uuid, p_provider text) to service_role;
revoke all on function public."luo_agent_checkout_state"(p_auth_user uuid, p_username text) from public,anon,authenticated;
grant execute on function public."luo_agent_checkout_state"(p_auth_user uuid, p_username text) to service_role;
revoke all on function public."luo_agent_claim_checkout_once"(p_intent uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_claim_checkout_once"(p_intent uuid) to service_role;
revoke all on function public."luo_agent_consume_quota"(p_agent uuid, p_metric text) from public,anon,authenticated;
grant execute on function public."luo_agent_consume_quota"(p_agent uuid, p_metric text) to service_role;
revoke all on function public."luo_agent_create_pending_identity"(p_auth_user uuid, p_username text, p_requested_plan text) from public,anon,authenticated;
grant execute on function public."luo_agent_create_pending_identity"(p_auth_user uuid, p_username text, p_requested_plan text) to service_role;
revoke all on function public."luo_agent_create_verified_pending_identity"(p_auth_user uuid, p_username text, p_requested_plan text, p_verification uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_create_verified_pending_identity"(p_auth_user uuid, p_username text, p_requested_plan text, p_verification uuid) to service_role;
revoke all on function public."luo_agent_has_active_entitlement"(p_agent uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_has_active_entitlement"(p_agent uuid) to service_role;
revoke all on function public."luo_agent_approve_peer"(p_actor uuid, p_other uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_approve_peer"(p_actor uuid, p_other uuid) to service_role;
revoke all on function public."luo_agent_delete_post"(p_agent uuid, p_post uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_delete_post"(p_agent uuid, p_post uuid) to service_role;
revoke all on function public."luo_agent_find_paid_identity"(p_auth_user uuid, p_username text) from public,anon,authenticated;
grant execute on function public."luo_agent_find_paid_identity"(p_auth_user uuid, p_username text) to service_role;
revoke all on function public."luo_agent_find_peer"(p_actor uuid, p_username text) from public,anon,authenticated;
grant execute on function public."luo_agent_find_peer"(p_actor uuid, p_username text) to service_role;
revoke all on function public."luo_agent_find_verified_paid_identity"(p_auth_user uuid, p_username text) from public,anon,authenticated;
grant execute on function public."luo_agent_find_verified_paid_identity"(p_auth_user uuid, p_username text) to service_role;
revoke all on function public."luo_agent_issue_api_key"(p_agent uuid, p_hash bytea, p_prefix text, p_scopes text[]) from public,anon,authenticated;
grant execute on function public."luo_agent_issue_api_key"(p_agent uuid, p_hash bytea, p_prefix text, p_scopes text[]) to service_role;
revoke all on function public."luo_agent_publish_post"(p_agent uuid, p_operation uuid, p_body text) from public,anon,authenticated;
grant execute on function public."luo_agent_publish_post"(p_agent uuid, p_operation uuid, p_body text) to service_role;
revoke all on function public."luo_agent_read_peer_messages"(p_actor uuid, p_peer uuid, p_limit integer) from public,anon,authenticated;
grant execute on function public."luo_agent_read_peer_messages"(p_actor uuid, p_peer uuid, p_limit integer) to service_role;
revoke all on function public."luo_agent_read_profile"(p_agent uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_read_profile"(p_agent uuid) to service_role;
revoke all on function public."luo_agent_read_public_posts"(p_agent uuid, p_before timestamp with time zone, p_before_id uuid, p_limit integer) from public,anon,authenticated;
grant execute on function public."luo_agent_read_public_posts"(p_agent uuid, p_before timestamp with time zone, p_before_id uuid, p_limit integer) to service_role;
revoke all on function public."luo_agent_read_usage"(p_agent uuid) from public,anon,authenticated;
grant execute on function public."luo_agent_read_usage"(p_agent uuid) to service_role;
revoke all on function public."luo_agent_record_verified_payment"(p_agent uuid, p_provider text, p_event text, p_event_type text, p_subscription text, p_customer text, p_price text, p_plan text, p_amount bigint, p_currency text, p_paid_through timestamp with time zone) from public,anon,authenticated;
grant execute on function public."luo_agent_record_verified_payment"(p_agent uuid, p_provider text, p_event text, p_event_type text, p_subscription text, p_customer text, p_price text, p_plan text, p_amount bigint, p_currency text, p_paid_through timestamp with time zone) to service_role;
revoke all on function public."luo_agent_record_reconciled_checkout"(p_intent uuid, p_provider text, p_reference text, p_event text, p_event_type text, p_subscription text, p_customer text, p_price text, p_amount bigint, p_paid_through timestamp with time zone) from public,anon,authenticated;
grant execute on function public."luo_agent_record_reconciled_checkout"(p_intent uuid, p_provider text, p_reference text, p_event text, p_event_type text, p_subscription text, p_customer text, p_price text, p_amount bigint, p_paid_through timestamp with time zone) to service_role;
revoke all on function public."luo_agent_replace_session"(p_agent uuid, p_hash bytea, p_ttl integer) from public,anon,authenticated;
grant execute on function public."luo_agent_replace_session"(p_agent uuid, p_hash bytea, p_ttl integer) to service_role;
revoke all on function public."luo_agent_reserve_checkout"(p_auth_user uuid, p_plan text, p_provider text, p_promo boolean) from public,anon,authenticated;
grant execute on function public."luo_agent_reserve_checkout"(p_auth_user uuid, p_plan text, p_provider text, p_promo boolean) to service_role;
revoke all on function public."luo_agent_reserve_login"(p_ip_digest text, p_username_digest text) from public,anon,authenticated;
grant execute on function public."luo_agent_reserve_login"(p_ip_digest text, p_username_digest text) to service_role;
revoke all on function public."luo_agent_reserve_pending_signup"(p_identity_digest text, p_network_digest text) from public,anon,authenticated;
grant execute on function public."luo_agent_reserve_pending_signup"(p_identity_digest text, p_network_digest text) to service_role;
revoke all on function public."luo_agent_resolve_api_key"(p_hash bytea, p_scope text) from public,anon,authenticated;
grant execute on function public."luo_agent_resolve_api_key"(p_hash bytea, p_scope text) to service_role;
revoke all on function public."luo_agent_send_peer_message"(p_sender uuid, p_recipient uuid, p_client_id uuid, p_text text) from public,anon,authenticated;
grant execute on function public."luo_agent_send_peer_message"(p_sender uuid, p_recipient uuid, p_client_id uuid, p_text text) to service_role;
revoke all on function public."luo_agent_session_is_current"(p_agent uuid, p_hash bytea, p_generation bigint) from public,anon,authenticated;
grant execute on function public."luo_agent_session_is_current"(p_agent uuid, p_hash bytea, p_generation bigint) to service_role;
revoke all on function public."luo_agent_set_feed_preference"(p_agent uuid, p_author uuid, p_action text) from public,anon,authenticated;
grant execute on function public."luo_agent_set_feed_preference"(p_agent uuid, p_author uuid, p_action text) to service_role;
revoke all on function public."luo_agent_suspend_paid_identity"(p_provider text, p_subscription text, p_event text, p_state text) from public,anon,authenticated;
grant execute on function public."luo_agent_suspend_paid_identity"(p_provider text, p_subscription text, p_event text, p_state text) to service_role;
revoke all on function public."luo_agent_verified_checkout_eligible"(p_auth_user uuid, p_username text, p_plan text) from public,anon,authenticated;
grant execute on function public."luo_agent_verified_checkout_eligible"(p_auth_user uuid, p_username text, p_plan text) to service_role;
commit;