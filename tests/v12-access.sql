begin;
insert into auth.users(id,email,raw_user_meta_data) values
('e6161616-1616-4616-8616-161616161616','v12-a@example.invalid','{"username":"luo_v12_a"}'),
('e7171717-1717-4717-8717-171717171717','v12-b@example.invalid','{"username":"luo_v12_b"}'),
('e8181818-1818-4818-8818-181818181818','v12-c@example.invalid','{"username":"luo_v12_c"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e6161616-1616-4616-8616-161616161616","role":"authenticated"}',true);
do $$ declare cid uuid; root public.chat_messages;reply public.chat_messages;retry public.chat_messages;gid uuid;announcement public.chat_messages;card uuid;game uuid;quiz uuid;
begin
 cid:=public.start_direct_chat('luo_v12_b');perform set_config('luotest.v12conv',cid::text,true);
 root:=public.send_chat_message_idempotent(cid,'root-v12-check','First sentence. Important promise. Last sentence.','text',null);perform set_config('luotest.v12root',root.id::text,true);
 reply:=public.send_chat_advanced(cid,'quote-v12-check','I agree',root.id,'Important promise.',3600);
 retry:=public.send_chat_advanced(cid,'quote-v12-check','I agree',root.id,'Important promise.',3600);
 if retry.id<>reply.id or retry.expires_at<>reply.expires_at or reply.reply_excerpt<>'Important promise.' then raise exception 'Quote/expiry idempotency failed';end if;
 begin perform public.send_chat_advanced(cid,'badquote-v12','Bad quote',root.id,'Forged sentence',null);raise exception 'Forged quote allowed';exception when raise_exception then if sqlerrm='Forged quote allowed' then raise;end if;end;
 perform public.save_chat_vault(root.id,'Promises','Call Friday');
 insert into public.voice_transcripts(user_id,message_id,transcript,language_code,source) values(auth.uid(),root.id,'Private transcript alpha','en','manual');
 card:=public.create_chat_living_message(cid,'checklist','{"title":"Packing","items":[{"text":"Passport","done":false}]}','checklist-v12');perform set_config('luotest.v12card',card::text,true);
 game:=public.start_chat_tictactoe(cid,'game-v12');perform set_config('luotest.v12game',game::text,true);
 perform public.play_chat_tictactoe(game,0,1);
 begin perform public.play_chat_tictactoe(game,1,2);raise exception 'Double turn allowed';exception when raise_exception then if sqlerrm='Double turn allowed' then raise;end if;end;
 quiz:=public.create_chat_question(cid,'What is 2 + 2?',array['3','4'],'quiz',2,'quiz-v12');perform set_config('luotest.v12quiz',quiz::text,true);
 gid:=public.create_group_chat('V12 permissions test',array['luo_v12_b']);perform set_config('luotest.v12group',gid::text,true);
 perform public.set_chat_group_rules(gid,false,false,true);
 announcement:=public.send_chat_message_idempotent(gid,'announcement-v12','Announcement','text',null);perform set_config('luotest.v12announcement',announcement.id::text,true);
 if (select count(*) from public.search_chat_everything('Important','me',null,null,null,80))<>1 then raise exception 'Search sender/text filter failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e7171717-1717-4717-8717-171717171717","role":"authenticated"}',true);
do $$ declare poll jsonb;pid uuid;oid uuid;cid uuid:=current_setting('luotest.v12conv')::uuid;gid uuid:=current_setting('luotest.v12group')::uuid;mid uuid:=current_setting('luotest.v12root')::uuid;
begin
 if exists(select 1 from public.message_bookmarks where message_id=mid) then raise exception 'Vault leaked';end if;
 if exists(select 1 from public.voice_transcripts where message_id=mid) then raise exception 'Transcript leaked';end if;
 insert into public.voice_transcripts(user_id,message_id,transcript,language_code,source) values(auth.uid(),mid,'Private transcript beta','en','manual');
 if (select count(*) from public.voice_transcripts where message_id=mid)<>1 then raise exception 'Per-person transcript failed';end if;
 perform public.update_chat_living_message(current_setting('luotest.v12card')::uuid,1,0,null);
 if not exists(select 1 from public.chat_living_messages where message_id=current_setting('luotest.v12card')::uuid and version=2 and(payload->'items'->0->>'done')::boolean) then raise exception 'Shared checklist failed';end if;
 begin perform public.update_chat_living_message(current_setting('luotest.v12card')::uuid,1,0,null);raise exception 'Stale card write allowed';exception when raise_exception then if sqlerrm='Stale card write allowed' then raise;end if;end;
 perform public.play_chat_tictactoe(current_setting('luotest.v12game')::uuid,3,2);
 select options,poll_id into poll,pid from public.get_chat_polls(array[current_setting('luotest.v12quiz')::uuid]);
 if poll->0->>'correct' is not null then raise exception 'Quiz answer exposed before vote';end if;
 oid:=(poll->1->>'id')::uuid;perform public.vote_chat_simple_poll(pid,oid);
 select options into poll from public.get_chat_polls(array[current_setting('luotest.v12quiz')::uuid]);
 if not(poll->1->>'correct')::boolean then raise exception 'Quiz feedback missing';end if;
 begin perform public.set_chat_group_rules(gid,true,true,true);raise exception 'Member changed permissions';exception when raise_exception then if sqlerrm='Member changed permissions' then raise;end if;end;
 begin perform public.send_chat_message_idempotent(gid,'forbidden-v12','No root posts','text',null);raise exception 'Announcement permission bypass';exception when raise_exception then if sqlerrm='Announcement permission bypass' then raise;end if;end;
 perform public.send_chat_message_idempotent(gid,'allowedreply-v12','A reply','text',current_setting('luotest.v12announcement')::uuid);
 begin perform public.send_chat_message_idempotent(gid,'forbiddenfile-v12','No files','file',null);raise exception 'File permission bypass';exception when raise_exception then if sqlerrm='File permission bypass' then raise;end if;end;
 begin perform public.expire_my_chat_message(mid,60);raise exception 'Other user changed expiry';exception when raise_exception then if sqlerrm='Other user changed expiry' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e8181818-1818-4818-8818-181818181818","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.chat_living_messages where conversation_id=current_setting('luotest.v12conv')::uuid) or exists(select 1 from public.chat_tictactoe where conversation_id=current_setting('luotest.v12conv')::uuid) then raise exception 'Interactive content leaked';end if;
 if exists(select 1 from public.search_chat_everything('Important',null,null,null,null,80)) then raise exception 'Search leaked';end if;
 begin perform public.play_chat_tictactoe(current_setting('luotest.v12game')::uuid,1,3);raise exception 'Outsider played';exception when raise_exception then if sqlerrm='Outsider played' then raise;end if;end;
end $$;
reset role;
update public.chat_messages set expires_at=now()-interval '1 second' where id=current_setting('luotest.v12root')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e7171717-1717-4717-8717-171717171717","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.chat_messages where id=current_setting('luotest.v12root')::uuid) then raise exception 'Expired message readable';end if;
 if exists(select 1 from public.search_chat_everything('Important',null,null,null,null,80)) then raise exception 'Expired message searchable';end if;
end $$;
reset role;
select 'PASS: sentence quote integrity and retry; timed expiry and RLS; private vault/transcript isolation; shared checklist and version conflict; multiplayer turns; quiz feedback gating; group announcement/reply/file permissions; cross-member/outsider search isolation' as verification;
rollback;
