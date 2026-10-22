-- Metadata-only security fixtures, rolled back in full.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('ab151515-1515-4515-8515-151515151515','suite-a@example.invalid','{"username":"luo_suite_a"}'),
('ab252525-2525-4525-8525-252525252525','suite-b@example.invalid','{"username":"luo_suite_b"}'),
('ab353535-3535-4535-8535-353535353535','suite-c@example.invalid','{"username":"luo_suite_c"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ab151515-1515-4515-8515-151515151515","role":"authenticated"}',true);
do $$declare room uuid;gid uuid;bid uuid;cid uuid;begin
 room=public.start_direct_chat('luo_suite_b');perform set_config('luotest.suite.room',room::text,true);
 gid=public.create_group_chat('Suite private drawing fixture',array['luo_suite_b']);perform set_config('luotest.suite.group',gid::text,true);perform public.set_chat_group_rules(gid,false,false,true);insert into public.chat_drawing_boards(conversation_id,created_by,title) values(gid,auth.uid(),'Admin fixture') returning id into bid;perform set_config('luotest.suite.groupboard',bid::text,true);
 insert into public.chat_private_documents(user_id,document_id,kind,title,payload) values(auth.uid(),'private-fixture','archive','Private fixture','{"messages":[{"body":"Private fixture"}]}');
 insert into public.chat_drawing_boards(conversation_id,created_by,title) values(room,auth.uid(),'Shared fixture') returning id into bid;perform set_config('luotest.suite.board',bid::text,true);
 perform public.append_chat_drawing(bid,'ab454545-4545-4545-8545-454545454545','{"points":[[0.1,0.2],[0.3,0.4]],"color":"#e7c56f","width":"4"}');
 perform public.append_chat_drawing(bid,'ab454545-4545-4545-8545-454545454545','{"points":[[0.1,0.2]],"color":"#e7c56f","width":"4"}');
 if(select count(*) from public.chat_drawing_strokes where board_id=bid)<>1 then raise exception 'Stroke retry duplicated';end if;
 begin perform public.append_chat_drawing(bid,gen_random_uuid(),'{"color":"#e7c56f","width":"4"}');raise exception 'Missing points accepted';exception when raise_exception then if sqlerrm='Missing points accepted' then raise;end if;end;
 cid=public.start_luo_call(room,'audio','{"type":"offer","sdp":"fixture"}');perform set_config('luotest.suite.call',cid::text,true);
 begin perform public.signal_luo_call(cid,'answer','{"type":"answer","sdp":"forged"}');raise exception 'Caller answered itself';exception when raise_exception then if sqlerrm='Caller answered itself' then raise;end if;end;
 begin perform public.luo_push_worker_config();raise exception 'Worker secrets exposed';exception when insufficient_privilege then null;end;
 begin insert into public.chat_push_subscriptions(user_id,endpoint,p256dh,auth_key) values(auth.uid(),'https://127.0.0.1/private',repeat('A',87),repeat('A',22));raise exception 'SSRF endpoint accepted';exception when check_violation then null;end;
 insert into public.chat_push_subscriptions(user_id,endpoint,p256dh,auth_key) values(auth.uid(),'https://fcm.googleapis.com/fcm/send/fixture-suite-a',repeat('A',87),repeat('A',22));
end$$;
select set_config('request.jwt.claims','{"sub":"ab252525-2525-4525-8525-252525252525","role":"authenticated"}',true);
do $$declare b uuid;begin
 if exists(select 1 from public.chat_private_documents where document_id='private-fixture') then raise exception 'Foreign archive readable';end if;
 if exists(select 1 from public.chat_push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/fixture-suite-a') then raise exception 'Foreign push endpoint readable';end if;
 begin update public.chat_private_documents set user_id=auth.uid() where document_id='private-fixture';if found then raise exception 'Foreign archive claimed';end if;exception when insufficient_privilege then null;end;
 if not exists(select 1 from public.chat_drawing_boards where id=current_setting('luotest.suite.board')::uuid) then raise exception 'Member board unavailable';end if;
 perform public.append_chat_drawing(current_setting('luotest.suite.board')::uuid,gen_random_uuid(),'{"points":[[0.5,0.5]],"color":"#ffffff","width":"2"}');
 begin insert into public.chat_drawing_boards(conversation_id,created_by,title) values(current_setting('luotest.suite.group')::uuid,auth.uid(),'Announcement bypass');raise exception 'Announcement bypass accepted';exception when insufficient_privilege then null;end;
 perform public.signal_luo_call(current_setting('luotest.suite.call')::uuid,'answer','{"type":"answer","sdp":"fixture"}');
 perform public.signal_luo_call(current_setting('luotest.suite.call')::uuid,'ice','{"candidate":"candidate:fixture"}');
 perform public.signal_luo_call(current_setting('luotest.suite.call')::uuid,'end');
 if exists(select 1 from public.chat_calls where id=current_setting('luotest.suite.call')::uuid and(offer is not null or answer is not null or jsonb_array_length(caller_ice)>0 or jsonb_array_length(callee_ice)>0)) then raise exception 'Ended signaling retained';end if;
 perform public.set_chat_user_block('ab151515-1515-4515-8515-151515151515',true);
 begin perform public.append_chat_drawing(current_setting('luotest.suite.board')::uuid,gen_random_uuid(),'{"points":[[0.5,0.5]],"color":"#ffffff","width":"2"}');raise exception 'Block bypass accepted';exception when raise_exception then if sqlerrm='Block bypass accepted' then raise;end if;end;
 begin perform public.start_luo_call(current_setting('luotest.suite.room')::uuid,'audio','fixture');raise exception 'Blocked call allowed';exception when raise_exception then if sqlerrm='Blocked call allowed' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"sub":"ab353535-3535-4535-8535-353535353535","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.chat_calls where id=current_setting('luotest.suite.call')::uuid) then raise exception 'Outsider call data leaked';end if;
 if exists(select 1 from public.chat_drawing_boards where id=current_setting('luotest.suite.board')::uuid) then raise exception 'Outsider board leaked';end if;
 if exists(select 1 from public.chat_drawing_strokes where board_id=current_setting('luotest.suite.board')::uuid) then raise exception 'Outsider strokes leaked';end if;
 begin perform public.signal_luo_call(current_setting('luotest.suite.call')::uuid,'ice','{"candidate":"forged"}');raise exception 'Outsider signaled';exception when raise_exception then if sqlerrm='Outsider signaled' then raise;end if;end;
end$$;
reset role;
update public.chat_group_rules set archived=true where conversation_id=current_setting('luotest.suite.group')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ab151515-1515-4515-8515-151515151515","role":"authenticated"}',true);
do $$begin begin perform public.append_chat_drawing(current_setting('luotest.suite.groupboard')::uuid,gen_random_uuid(),'{"points":[[0.5,0.5]],"color":"#ffffff","width":"2"}');raise exception 'Archived group drawing accepted';exception when raise_exception then if sqlerrm='Archived group drawing accepted' then raise;end if;end;end$$;
reset role;
select 'PASS: private document and push isolation, worker secret access denial, SSRF rejection, board membership/blocks/announcement enforcement, stroke idempotency, call role enforcement and signaling cleanup' as verification;
rollback;
