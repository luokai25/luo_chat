-- Metadata-only attacker fixtures. No user files are read, uploaded or deleted.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('ee111111-1111-4111-8111-111111111111','attack-a@example.invalid','{"username":"attack_fixture_a"}'),
('ee222222-2222-4222-8222-222222222222','attack-b@example.invalid','{"username":"attack_fixture_b"}'),
('ee333333-3333-4333-8333-333333333333','attack-c@example.invalid','{"username":"attack_fixture_c"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ee111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select set_config('attack.room',public.start_direct_chat('attack_fixture_b')::text,true);
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata,user_metadata) values
('chat-media',current_setting('attack.room')||'/ee111111-1111-4111-8111-111111111111/upload-good-one','ee111111-1111-4111-8111-111111111111','{"size":10,"mimetype":"text/plain"}',jsonb_build_object('checksum',repeat('a',64))),
('chat-media',current_setting('attack.room')||'/ee111111-1111-4111-8111-111111111111/upload-wrong-owner','ee222222-2222-4222-8222-222222222222','{"size":10,"mimetype":"text/plain"}',jsonb_build_object('checksum',repeat('a',64)));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ee111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$declare c uuid:=current_setting('attack.room')::uuid;path text:=c::text||'/'||auth.uid()::text||'/upload-good-one';m public.chat_messages;again public.chat_messages;begin
 begin perform public.send_chat_attachment(c,'upload-good-one','File',null,path,'file.pdf','application/pdf',10,repeat('a',64));raise exception 'ATTACK_ACCEPTED: forged MIME';exception when raise_exception then if sqlerrm like 'ATTACK_ACCEPTED:%' then raise;end if;end;
 begin perform public.send_chat_attachment(c,'upload-good-one','File',null,path,'file.txt','text/plain',11,repeat('a',64));raise exception 'ATTACK_ACCEPTED: forged size';exception when raise_exception then if sqlerrm like 'ATTACK_ACCEPTED:%' then raise;end if;end;
 begin perform public.send_chat_attachment(c,'upload-good-one','File',null,path,'file.txt','text/plain',10,repeat('b',64));raise exception 'ATTACK_ACCEPTED: forged checksum';exception when raise_exception then if sqlerrm like 'ATTACK_ACCEPTED:%' then raise;end if;end;
 begin perform public.send_chat_attachment(c,'upload-wrong-owner','File',null,c::text||'/'||auth.uid()::text||'/upload-wrong-owner','file.txt','text/plain',10,repeat('a',64));raise exception 'ATTACK_ACCEPTED: foreign object owner';exception when raise_exception then if sqlerrm like 'ATTACK_ACCEPTED:%' then raise;end if;end;
 m:=public.send_chat_attachment(c,'upload-good-one','File',null,path,'file.txt','text/plain',10,repeat('a',64));
 again:=public.send_chat_attachment(c,'upload-good-one','File',null,path,'file.txt','text/plain',10,repeat('a',64));
 if m.id<>again.id or(select count(*) from public.chat_attachments where message_id=m.id)<>1 then raise exception 'Valid upload/retry broken';end if;
 perform set_config('attack.message',m.id::text,true);
 begin insert into public.chat_attachments(message_id,conversation_id,uploader_id,object_path,file_name,mime_type,byte_size) values(m.id,c,auth.uid(),c::text||'/'||auth.uid()::text||'/missing','missing.pdf','application/pdf',1);raise exception 'ATTACK_ACCEPTED: direct metadata insert';exception when insufficient_privilege then null;end;
 begin delete from public.chat_attachments where message_id=m.id;raise exception 'ATTACK_ACCEPTED: direct metadata delete';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"ee222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$begin if public.recall_own_message(current_setting('attack.message')::uuid) then raise exception 'ATTACK_ACCEPTED: peer recall';end if;if not exists(select 1 from public.chat_attachments where message_id=current_setting('attack.message')::uuid) then raise exception 'Recipient access broken';end if;end $$;
select set_config('request.jwt.claims','{"sub":"ee333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$begin
 if public.recall_own_message(current_setting('attack.message')::uuid) then raise exception 'ATTACK_ACCEPTED: outsider recall';end if;
 if exists(select 1 from public.chat_attachments where message_id=current_setting('attack.message')::uuid) then raise exception 'ATTACK_ACCEPTED: outsider attachment read';end if;
 if exists(select 1 from storage.objects where bucket_id='chat-media' and name like current_setting('attack.room')||'/%') then raise exception 'ATTACK_ACCEPTED: outsider Storage read';end if;
 begin perform public.send_chat_attachment(current_setting('attack.room')::uuid,'outsider-send-op','File',null,'missing','file.txt','text/plain',10,repeat('a',64));raise exception 'ATTACK_ACCEPTED: outsider send';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"ee111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$begin if not public.recall_own_message(current_setting('attack.message')::uuid) then raise exception 'Owner recall broken';end if;if public.recall_own_message(current_setting('attack.message')::uuid) then raise exception 'Recall repeated';end if;end $$;
select set_config('request.jwt.claims','{"sub":"ee222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.chat_attachments where message_id=current_setting('attack.message')::uuid) then raise exception 'ATTACK_ACCEPTED: recalled attachment read';end if;if exists(select 1 from storage.objects where bucket_id='chat-media' and name=current_setting('attack.room')||'/ee111111-1111-4111-8111-111111111111/upload-good-one') then raise exception 'ATTACK_ACCEPTED: recalled storage read';end if;end $$;
reset role;
rollback;
select 'PASS: forged MIME/size/checksum/owner denied; direct metadata writes denied; valid upload and retry preserved; outsider and recall access denied' as verification;
