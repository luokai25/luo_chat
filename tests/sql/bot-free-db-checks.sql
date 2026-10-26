-- Runs ONLY against disposable PostgreSQL in GitHub Actions.
-- psql -v ON_ERROR_STOP=1 must abort on any failed assertion.
do $$
begin
 if has_schema_privilege('anon','luo_bots','USAGE')
  or has_schema_privilege('authenticated','luo_bots','USAGE')
 then raise exception 'Private schema exposed to clients'; end if;
 if has_table_privilege('anon','luo_bots.accounts','SELECT')
  or has_table_privilege('authenticated','luo_bots.credentials','SELECT')
 then raise exception 'Private bot data exposed to clients'; end if;
 if has_function_privilege('anon','public.reserve_luo_bot_action(uuid,text,uuid,uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.settle_luo_bot_payment(text,text,text,bigint,text,text)','EXECUTE')
  or has_function_privilege('anon','public.request_luo_bot_account(uuid,text)','EXECUTE')
 then raise exception 'Bot administrative RPC executable by human/anonymous role';end if;
end;$$;

-- Simulate trusted gateway claims. This is a throwaway DB with stubbed roles.
select set_config('request.jwt.claim.role','service_role',false);
do $$
declare bot uuid;
begin
 bot:=public.request_luo_bot_account(
  '11111111-1111-4111-8111-111111111111','bot_helper');
 if bot is null then raise exception 'Human owner could not request inactive bot';end if;
 if public.request_luo_bot_account(
  '11111111-1111-4111-8111-111111111111','bot_helper') is not null
 then raise exception 'Duplicate username bypass';end if;
 if public.request_luo_bot_account(
  '22222222-2222-4222-8222-222222222222','bot_cold') is not null
 then raise exception 'Bot can own another bot';end if;
 if exists(select 1 from luo_bots.accounts where id=bot
  and (not suspended or payment_status<>'unpaid'
   or moderation_status<>'pending' or cardinality(scopes)>0))
 then raise exception 'New bot was not disabled by default';end if;
 if public.reserve_luo_bot_action(
  bot,'read_assigned_thread',gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555')
 then raise exception 'Unpaid bot was authorized';end if;
 if public.activate_luo_bot_credential(
  '11111111-1111-4111-8111-111111111111',bot,repeat('a',64))
 then raise exception 'Unpaid bot credential activation';end if;
 insert into luo_bots.orders(
  bot_id,provider,provider_order_id,amount_minor,currency,tier)
 values(bot,'paymob','ci_order_0001',25000,'EGP','agent_basic');
 if public.settle_luo_bot_payment(
  'paymob','ci-payment-0001','ci_order_0001',24999,'EGP','paid')
 then raise exception 'Wrong amount credited';end if;
 if not public.settle_luo_bot_payment(
  'paymob','ci-payment-0001','ci_order_0001',25000,'EGP','paid')
 then raise exception 'Verified settlement failed';end if;
 if public.settle_luo_bot_payment(
  'paymob','ci-payment-0001','ci_order_0001',25000,'EGP','paid')
 then raise exception 'Duplicate payment extended period';end if;
 if exists(select 1 from luo_bots.accounts where id=bot
  and (payment_status<>'active' or not suspended or moderation_status<>'pending'))
 then raise exception 'Payment auto-approved or failed to activate accounting';end if;
 if public.reserve_luo_bot_action(
  bot,'read_assigned_thread',gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555')
 then raise exception 'Paid but unapproved bot accessed a chat';end if;
 -- Simulate explicit moderator review + bot-auth identity provisioning.
 update luo_bots.accounts
  set moderation_status='approved',bot_user_id='22222222-2222-4222-8222-222222222222',
      scopes=array['read_assigned_thread','send_reply']::text[]
 where id=bot;
 if not public.activate_luo_bot_credential(
  '11111111-1111-4111-8111-111111111111',bot,repeat('a',64))
 then raise exception 'Approved paid credential issuance failed';end if;
 if public.reserve_luo_bot_action(
  bot,'read_assigned_thread',gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555')
 then raise exception 'Bot read without human consent';end if;
 insert into luo_bots.thread_consents(
  bot_id,human_id,conversation_id,status,expires_at,scopes)
 values(
  bot,'33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555','active',
  now()+interval '1 day',array['read_assigned_thread']::text[]);
 if public.reserve_luo_bot_action(
  bot,'send_reply',gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555')
 then raise exception 'Bot reply without specific human reply consent';end if;
 if public.reserve_luo_bot_action(
  bot,'read_assigned_thread',gen_random_uuid(),
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555')
 then raise exception 'Non-member stranger granted access';end if;
 -- Authorized 1:1 consent, with replay protection.
 declare
  rid uuid:=gen_random_uuid();
 begin
  if not public.reserve_luo_bot_action(
   bot,'read_assigned_thread',rid,
   '33333333-3333-4333-8333-333333333333',
   '55555555-5555-4555-8555-555555555555')
  then raise exception 'Approved consented read blocked';end if;
  if public.reserve_luo_bot_action(
   bot,'read_assigned_thread',rid,
   '33333333-3333-4333-8333-333333333333',
   '55555555-5555-4555-8555-555555555555')
  then raise exception 'Duplicate request was accepted';end if;
 end;
 if not public.settle_luo_bot_payment(
  'paymob','ci-refund-00001','ci_order_0001',25000,'EGP','refunded')
 then raise exception 'Verified refund rejected';end if;
 if public.reserve_luo_bot_action(
  bot,'read_assigned_thread',gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555')
 then raise exception 'Refunded bot retained access';end if;
 if exists(select 1 from luo_bots.credentials where bot_id=bot and revoked_at is null)
 then raise exception 'Refunded bot retained live password';end if;
end;$$;

-- Deny even a fully valid-looking request when role claim is not service_role.
select set_config('request.jwt.claim.role','authenticated',false);
do $$
declare bot uuid;
begin
 select id into bot from luo_bots.accounts where username='bot_helper';
 if public.reserve_luo_bot_action(bot,'read_assigned_thread',gen_random_uuid())
 then raise exception 'Role guard bypassed';end if;
 if public.consume_luo_bot_login_limit(repeat('a',64),repeat('b',64))
 then raise exception 'Login throttling publicly callable';end if;
 if public.settle_luo_bot_payment(
  'paymob','fake-transaction','ci_order_0001',25000,'EGP','paid')
 then raise exception 'Payment settlement allowed to human role';end if;
end;$$;

-- No lasting test data; the entire container is disposed at workflow end.
select 'Bot database auth, payment, consent and permissions PASS' as result;
