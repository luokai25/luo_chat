begin;
insert into auth.users(id,email,raw_user_meta_data) values
('e1010101-0101-4101-8101-010101010101','luo-v10-a@example.invalid','{"username":"luov10_fixture_a"}'),
('e2020202-0202-4202-8202-020202020202','luo-v10-b@example.invalid','{"username":"luov10_fixture_b"}'),
('e3030303-0303-4303-8303-030303030303','luo-v10-c@example.invalid','{"username":"luov10_fixture_c"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e1010101-0101-4101-8101-010101010101","role":"authenticated"}',true);
select public.save_chat_contact('luov10_fixture_b');
select public.save_chat_contact('luov10_fixture_b');
do $$ begin
 if (select count(*) from public.get_my_chat_contacts())<>1 then raise exception 'Contact idempotency failed'; end if;
 if (select username from public.get_my_chat_contacts())<>'luov10_fixture_b' then raise exception 'Contact resolution failed'; end if;
 begin perform public.save_chat_contact('luov10_fixture_a');raise exception 'Self contact accepted';exception when raise_exception then if sqlerrm='Self contact accepted' then raise;end if;end;
 begin perform public.save_chat_contact('nonexistent_luov10');raise exception 'Unknown contact accepted';exception when raise_exception then if sqlerrm='Unknown contact accepted' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e3030303-0303-4303-8303-030303030303","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.get_my_chat_contacts())<>0 then raise exception 'Contact RPC leaked';end if;
 if (select count(*) from public.chat_contacts)<>0 then raise exception 'Contact RLS leaked';end if;
 delete from public.chat_contacts where owner_id='e1010101-0101-4101-8101-010101010101';
end $$;
select set_config('request.jwt.claims','{"sub":"e1010101-0101-4101-8101-010101010101","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.chat_contacts)<>1 then raise exception 'Nonowner deleted contact';end if;
 delete from public.chat_contacts;
 if (select count(*) from public.get_my_chat_contacts())<>0 then raise exception 'Owner removal failed';end if;
end $$;
do $$ declare cid uuid; mid uuid; begin
 cid:=public.start_direct_chat('luov10_fixture_b');
 select id into mid from public.send_chat_message_idempotent(cid,'v10-pin-check','Pin this safely','text',null);
 insert into public.message_pins(conversation_id,message_id,pinned_by) values(cid,mid,auth.uid());
 perform set_config('luotest.room',cid::text,true);perform set_config('luotest.message',mid::text,true);
 if (select count(*) from public.message_pins where conversation_id=cid)<>1 then raise exception 'Pin save failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e3030303-0303-4303-8303-030303030303","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.message_pins where conversation_id=current_setting('luotest.room')::uuid)<>0 then raise exception 'Pins leaked to nonmember';end if;
 begin
 insert into public.message_pins(conversation_id,message_id,pinned_by) values(current_setting('luotest.room')::uuid,current_setting('luotest.message')::uuid,auth.uid());
 raise exception 'Nonmember pin allowed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e2020202-0202-4202-8202-020202020202","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.message_pins where conversation_id=current_setting('luotest.room')::uuid)<>1 then raise exception 'Pin not shared with member';end if;
 delete from public.message_pins where conversation_id=current_setting('luotest.room')::uuid;
 if (select count(*) from public.message_pins where conversation_id=current_setting('luotest.room')::uuid)<>1 then raise exception 'Another member deleted pin';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e1010101-0101-4101-8101-010101010101","role":"authenticated"}',true);
delete from public.message_pins where conversation_id=current_setting('luotest.room')::uuid;
do $$ begin if (select count(*) from public.message_pins where conversation_id=current_setting('luotest.room')::uuid)<>0 then raise exception 'Owner pin removal failed';end if;end $$;
reset role;
select 'PASS: contact save, duplicate retry, exact resolution, self/unknown rejection, own-only read/RPC/delete, owner removal; member-only pin read/write and author-only removal' as verification;
rollback;
