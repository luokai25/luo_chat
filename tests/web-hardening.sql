-- Controlled accounts and quota hashes only; all changes roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('da111111-1111-4111-8111-111111111111','hardening-a@example.invalid','{"username":"hardening_fixture_a"}'),
('da222222-2222-4222-8222-222222222222','hardening-b@example.invalid','{"username":"hardening_fixture_b"}'),
('da333333-3333-4333-8333-333333333333','hardening-c@example.invalid','{"username":"hardening_fixture_c"}');
do $$begin
 for i in 1..5 loop if not public.consume_signup_rate_limit(repeat('a',64),repeat('b',64)) then raise exception 'Signup permitted requests rejected';end if;end loop;
 if public.consume_signup_rate_limit(repeat('a',64),repeat('c',64)) then raise exception 'Email quota bypass';end if;
 if public.consume_auth_action_limit(null,repeat('a',64),repeat('b',64)) then raise exception 'Null action accepted';end if;
 for i in 1..3 loop if not public.consume_auth_action_limit('password_reset',repeat('d',64),repeat('e',64),3,15,60) then raise exception 'Reset permitted requests rejected';end if;end loop;
 if public.consume_auth_action_limit('password_reset',repeat('d',64),repeat('f',64),3,15,60) then raise exception 'Reset email quota bypass';end if;
 if has_function_privilege('anon','public.consume_signup_rate_limit(text,text)','execute') or has_function_privilege('authenticated','public.consume_signup_rate_limit(text,text)','execute') then raise exception 'Quota RPC exposed';end if;
end;$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"da111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select set_config('hardening.room',public.start_direct_chat('hardening_fixture_b')::text,true);
do $$declare first_id uuid;retry_id uuid;c uuid:=current_setting('hardening.room')::uuid;begin
 for i in 1..120 loop perform public.send_chat_message_idempotent(c,'hardening-op-'||i,'Message '||i,'text',null);end loop;
 select id into first_id from public.chat_messages where conversation_id=c and client_operation_id='hardening-op-1';
 select id into retry_id from public.send_chat_message_idempotent(c,'hardening-op-1','Message 1','text',null);
 if retry_id is distinct from first_id then raise exception 'Retry duplicated message';end if;
 begin perform public.send_chat_message_idempotent(c,'hardening-over-quota','over quota','text',null);raise exception 'RATE_LIMIT_BYPASSED';exception when raise_exception then if sqlerrm='RATE_LIMIT_BYPASSED' or sqlerrm not like 'Message limit reached%' then raise;end if;end;
end;$$;
select set_config('request.jwt.claims','{"sub":"da333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.chat_messages where conversation_id=current_setting('hardening.room')::uuid) then raise exception 'Outsider message leak';end if;
 begin perform public.send_chat_message_idempotent(current_setting('hardening.room')::uuid,'outsider-hardening','Denied','text',null);raise exception 'OUTSIDER_ACCEPTED';exception when insufficient_privilege then null;end;
end;$$;
reset role;
rollback;
select 'PASS: quotas, denied RPC access, 120-message bound, idempotent retry at quota, outsider isolation' as result;
