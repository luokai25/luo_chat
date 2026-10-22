begin;
insert into auth.users(id,email,raw_user_meta_data) values
('a1212121-1212-4212-8212-121212121212','social-a@example.invalid','{"username":"luo_social_a"}'),
('b1212121-1212-4212-8212-121212121212','social-b@example.invalid','{"username":"luo_social_b"}'),
('c1212121-1212-4212-8212-121212121212','social-c@example.invalid','{"username":"luo_social_c"}'),
('d1212121-1212-4212-8212-121212121212','social-d@example.invalid','{"username":"luo_social_d"}');
create function pg_temp.deny(statement text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then return;end;raise exception 'Expected denial: %',statement;
end;$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
do $$declare sid uuid;gid uuid;dm uuid;m public.chat_messages;t uuid;begin
 sid:=public.create_private_chat_story('Private update',null,null,null,array['luo_social_b','luo_social_c'],'social-story-operation');perform set_config('luotest.story',sid::text,true);
 if sid<>public.create_private_chat_story('Private update',null,null,null,array['luo_social_b','luo_social_c'],'social-story-operation') then raise exception 'Story retry duplicated';end if;
 perform public.save_chat_story_circle('Friends',array['luo_social_b']);
 gid:=public.create_group_chat('Social tests',array['luo_social_b','luo_social_c']);perform set_config('luotest.group',gid::text,true);
 m:=public.send_chat_message_idempotent(gid,'social-library-message','Retain this file','text',null);perform set_config('luotest.groupfilemessage',m.id::text,true);
 t:=public.create_chat_group_task(gid,'No assignee','',now()+interval '1 day');perform set_config('luotest.task',t::text,true);
 perform public.manage_chat_bot_rule(gid,'Block','forbidden-word','',true);
 perform public.manage_chat_bot_rule(gid,'Help','hello-bot','Contact an admin',false);
 perform public.configure_chat_group_digest(gid,'daily');
 dm:=public.start_direct_chat('luo_social_b');perform set_config('luotest.dm',dm::text,true);
 m:=public.send_chat_message_idempotent(dm,'social-vault-operation','Keep this private snapshot','text',null);perform set_config('luotest.saved',m.id::text,true);
 perform public.save_chat_vault(m.id,'Instructions','Private only');
 perform public.set_chat_timeline_consent(dm,true);
 if public.chat_timeline_allowed(dm) then raise exception 'One-sided consent exposed timeline';end if;
 perform public.set_my_chat_presence_audience('selected',array['luo_social_b']);
end;$$;
select set_config('request.jwt.claims','{"sub":"b1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
do $$declare gid uuid:=current_setting('luotest.group')::uuid;dm uuid:=current_setting('luotest.dm')::uuid;begin
 if not exists(select 1 from public.chat_stories where id=current_setting('luotest.story')::uuid) then raise exception 'Recipient cannot see story';end if;
 if exists(select 1 from public.chat_story_circles) then raise exception 'Circle leaked';end if;
 insert into public.chat_story_reactions(story_id,user_id,reaction) values(current_setting('luotest.story')::uuid,auth.uid(),'👍');
 if exists(select 1 from public.chat_vault_items where origin_message_id=current_setting('luotest.saved')::uuid) then raise exception 'Vault snapshot leaked';end if;
 perform pg_temp.deny(format('select public.complete_chat_group_task(%L,true)',current_setting('luotest.task')));
 perform pg_temp.deny(format('select public.send_chat_message_idempotent(%L,%L,%L,%L,null)',gid,'social-blocked-op','forbidden-word','text'));
 perform public.send_chat_message_idempotent(gid,'social-trigger-bot','hello-bot','text',null);
 perform public.send_chat_message_idempotent(gid,'social-trigger-bot-2','hello-bot','text',null);
 if (select count(*) from public.chat_messages where conversation_id=gid and client_operation_id like 'luo-bot-%')<>1 then raise exception 'Bot missing or rate limit failed';end if;
 perform pg_temp.deny(format('select public.configure_chat_group_digest(%L,%L)',gid,'daily'));
 perform public.set_chat_timeline_consent(dm,true);
 if not public.chat_timeline_allowed(dm) then raise exception 'Mutual consent not enabled';end if;
 if (select count(*) from public.get_chat_friendship_timeline(dm))<>1 then raise exception 'Consented timeline missing';end if;
 if not public.can_view_chat_presence('a1212121-1212-4212-8212-121212121212') then raise exception 'Selected presence denied';end if;
end;$$;
select set_config('request.jwt.claims','{"sub":"c1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.chat_story_reactions where story_id=current_setting('luotest.story')::uuid) then raise exception 'Other recipient reaction leaked';end if;
 insert into public.chat_story_reactions(story_id,user_id,reaction) values(current_setting('luotest.story')::uuid,auth.uid(),'❤️');
 if public.can_view_chat_presence('a1212121-1212-4212-8212-121212121212') then raise exception 'Presence audience bypass';end if;
end;$$;
select set_config('request.jwt.claims','{"sub":"d1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.chat_stories where id=current_setting('luotest.story')::uuid) then raise exception 'Story leaked to outsider';end if;
 if exists(select 1 from public.chat_group_tasks where conversation_id=current_setting('luotest.group')::uuid) then raise exception 'Task leaked';end if;
 perform pg_temp.deny(format('insert into public.chat_story_reactions values(%L,%L,%L,now())',current_setting('luotest.story'),auth.uid(),'👍'));
 perform pg_temp.deny(format('select public.get_chat_friendship_timeline(%L)',current_setting('luotest.dm')));
end;$$;
select set_config('request.jwt.claims','{"sub":"a1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.chat_story_reactions where story_id=current_setting('luotest.story')::uuid)<>2 then raise exception 'Author cannot see reactions';end if;
 perform public.set_chat_timeline_consent(current_setting('luotest.dm')::uuid,false);
 if public.chat_timeline_allowed(current_setting('luotest.dm')::uuid) then raise exception 'Consent revocation failed';end if;
 perform public.complete_chat_group_task(current_setting('luotest.task')::uuid,true);
end;$$;
reset role;
-- Service fixtures use metadata only. They do not assert physical file transfer.
insert into public.chat_attachments(id,message_id,conversation_id,uploader_id,object_path,file_name,mime_type,byte_size)
values('f1212121-1212-4212-8212-121212121212',current_setting('luotest.groupfilemessage')::uuid,current_setting('luotest.group')::uuid,'a1212121-1212-4212-8212-121212121212',current_setting('luotest.group')||'/a1212121-1212-4212-8212-121212121212/retained.pdf','retained.pdf','application/pdf',10);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
select public.retain_chat_library_file('f1212121-1212-4212-8212-121212121212');
reset role;
delete from public.chat_messages where id in(current_setting('luotest.saved')::uuid,current_setting('luotest.groupfilemessage')::uuid);
do $$begin
 if not exists(select 1 from public.chat_vault_items where origin_message_id=current_setting('luotest.saved')::uuid and source_message_id is null and body='Keep this private snapshot') then raise exception 'Vault snapshot did not survive deletion';end if;
 if not exists(select 1 from public.chat_file_library where file_name='retained.pdf' and source_message_id is null) then raise exception 'Retained file metadata missing';end if;
 if exists(select 1 from public.storage_cleanup_queue where object_path=current_setting('luotest.group')||'/a1212121-1212-4212-8212-121212121212/retained.pdf') then raise exception 'Retained file wrongly queued';end if;
end;$$;
update public.chat_group_digests set next_run=now() where conversation_id=current_setting('luotest.group')::uuid;
select public.process_chat_group_digests();
do $$begin if not exists(select 1 from public.chat_messages where conversation_id=current_setting('luotest.group')::uuid and body like '[Luo recap%') then raise exception 'Recap not generated';end if;end;$$;
update public.chat_group_rules set archive_at=now()-interval '1 minute' where conversation_id=current_setting('luotest.group')::uuid;
-- Ensure rule exists when testing expiry, even if no explicit configuration was needed before.
insert into public.chat_group_rules(conversation_id,archive_at) values(current_setting('luotest.group')::uuid,now()-interval '1 minute') on conflict(conversation_id) do update set archive_at=excluded.archive_at;
select public.archive_due_chat_groups();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1212121-1212-4212-8212-121212121212","role":"authenticated"}',true);
select pg_temp.deny(format('select public.send_chat_message_idempotent(%L,%L,%L,%L,null)',current_setting('luotest.group'),'social-archive-deny','No more','text'));
select public.remove_chat_library_file((select id from public.chat_file_library where conversation_id=current_setting('luotest.group')::uuid limit 1));
reset role;
do $$begin if not exists(select 1 from public.storage_cleanup_queue where object_path=current_setting('luotest.group')||'/a1212121-1212-4212-8212-121212121212/retained.pdf') then raise exception 'Unretained file cleanup not queued';end if;end;$$;
rollback;
select 'PASS: story audience and reaction privacy; private circles/vault; task authorization; bot moderation/rate limit; mutual-consent timeline/revocation; selected presence; snapshot/library retention; digest worker; temporary archive; cleanup queue' as verification;
