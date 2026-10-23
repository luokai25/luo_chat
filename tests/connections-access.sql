begin;
insert into auth.users(id,email,raw_user_meta_data) values
('a2323232-2323-4232-8232-232323232323','connections-a@example.invalid','{"username":"luo_conn_a"}'),
('b2323232-2323-4232-8232-232323232323','connections-b@example.invalid','{"username":"luo_conn_b"}'),
('c2323232-2323-4232-8232-232323232323','connections-c@example.invalid','{"username":"luo_conn_c"}');
create function pg_temp.must_deny(statement text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then return;end;raise exception 'Expected denial: %',statement;
end;$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2323232-2323-4232-8232-232323232323","role":"authenticated"}',true);
select public.change_chat_connection('b2323232-2323-4232-8232-232323232323','request');
select public.change_chat_connection('b2323232-2323-4232-8232-232323232323','request');
do $$begin
 if (select count(*) from public.get_chat_connections('outgoing'))<>1 then raise exception 'Request retry duplicated';end if;
 if (select relationship from public.get_chat_person('b2323232-2323-4232-8232-232323232323'))<>'outgoing' then raise exception 'Outgoing state missing';end if;
 perform pg_temp.must_deny($q$select public.change_chat_connection('b2323232-2323-4232-8232-232323232323','accept')$q$);
 perform pg_temp.must_deny($q$select public.change_chat_connection('a2323232-2323-4232-8232-232323232323','request')$q$);
 perform pg_temp.must_deny($q$select public.change_chat_connection('b2323232-2323-4232-8232-232323232323',null)$q$);
 perform pg_temp.must_deny($q$delete from public.chat_connections$q$);
end;$$;
select set_config('request.jwt.claims','{"sub":"c2323232-2323-4232-8232-232323232323","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.chat_connections) then raise exception 'Third-party connection leak';end if;
 perform pg_temp.must_deny($q$select public.change_chat_connection('b2323232-2323-4232-8232-232323232323','accept')$q$);
end;$$;
select set_config('request.jwt.claims','{"sub":"b2323232-2323-4232-8232-232323232323","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.get_chat_connections('incoming'))<>1 then raise exception 'Missing incoming request';end if;
 -- Reciprocal request must not silently approve an incoming request.
 perform public.change_chat_connection('a2323232-2323-4232-8232-232323232323','request');
 if (select count(*) from public.get_chat_connections('incoming'))<>1 then raise exception 'Reciprocal request auto-approved';end if;
 perform public.change_chat_connection('a2323232-2323-4232-8232-232323232323','accept');
 perform public.change_chat_connection('a2323232-2323-4232-8232-232323232323','accept');
 if (select count(*) from public.get_chat_connections('friends'))<>1 then raise exception 'Acceptance failed';end if;
 if exists(select 1 from public.get_chat_connections('friends','ffffffff-ffff-ffff-ffff-ffffffffffff')) then raise exception 'Cursor not enforced';end if;
 perform public.set_chat_user_block('a2323232-2323-4232-8232-232323232323',true);
 if exists(select 1 from public.chat_connections) then raise exception 'Block kept friendship';end if;
 if not (select is_blocked from public.get_chat_person('a2323232-2323-4232-8232-232323232323')) then raise exception 'Cannot manage blocked person';end if;
end;$$;
select set_config('request.jwt.claims','{"sub":"a2323232-2323-4232-8232-232323232323","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.get_chat_person('b2323232-2323-4232-8232-232323232323')) then raise exception 'Blocked profile visible';end if;
 perform pg_temp.must_deny($q$select public.change_chat_connection('b2323232-2323-4232-8232-232323232323','request')$q$);
 perform pg_temp.must_deny($q$select public.start_direct_chat('luo_conn_b')$q$);
end;$$;
select set_config('request.jwt.claims','{"sub":"b2323232-2323-4232-8232-232323232323","role":"authenticated"}',true);
select public.set_chat_user_block('a2323232-2323-4232-8232-232323232323',false);
do $$begin
 if (select relationship from public.get_chat_person('a2323232-2323-4232-8232-232323232323'))<>'none' then raise exception 'Unblock restored friendship';end if;
 perform public.change_chat_connection('a2323232-2323-4232-8232-232323232323','request');
 perform public.change_chat_connection('a2323232-2323-4232-8232-232323232323','cancel');
 perform public.change_chat_connection('a2323232-2323-4232-8232-232323232323','cancel');
 perform pg_temp.must_deny($q$select public.change_chat_connection('a2323232-2323-4232-8232-232323232323','request')$q$);
end;$$;
reset role;
update luo_internal.friend_request_limits set requests=20 where user_id='a2323232-2323-4232-8232-232323232323';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2323232-2323-4232-8232-232323232323","role":"authenticated"}',true);
select pg_temp.must_deny($q$select public.change_chat_connection('c2323232-2323-4232-8232-232323232323','request')$q$);
select pg_temp.must_deny($q$select * from luo_internal.friend_request_limits$q$);
reset role;
update luo_internal.friend_request_limits set requests=1 where user_id='a2323232-2323-4232-8232-232323232323';
-- Counter is private, bounded and does not increment on duplicate requests.
do $$begin
 if (select requests from luo_internal.friend_request_limits where user_id='a2323232-2323-4232-8232-232323232323')<>1 then raise exception 'Retry consumed extra quota';end if;
end;$$;
set local role anon;
select pg_temp.must_deny($q$select public.get_chat_person('a2323232-2323-4232-8232-232323232323')$q$);
select pg_temp.must_deny($q$select public.change_chat_connection('a2323232-2323-4232-8232-232323232323','request')$q$);
select pg_temp.must_deny($q$select * from public.chat_connections$q$);
rollback;
