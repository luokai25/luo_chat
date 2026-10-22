-- Version 12 conversation tools. Existing client releases remain compatible.
alter table public.chat_messages add column if not exists reply_excerpt text check (char_length(reply_excerpt)<=500);
alter table public.user_conversation_settings add column if not exists appearance jsonb not null default '{}'::jsonb check(jsonb_typeof(appearance)='object' and octet_length(appearance::text)<=4096);
-- Transcripts are private per person, so multiple members may keep their own transcription.
alter table public.voice_transcripts drop constraint voice_transcripts_pkey;
alter table public.voice_transcripts add primary key(user_id,message_id);
create policy messages_live_only on public.chat_messages as restrictive for select to authenticated using(deleted_at is null and recalled_at is null and (expires_at is null or expires_at>now()));
create policy attachment_live_only on public.chat_attachments as restrictive for select to authenticated using(exists(select 1 from public.chat_messages m where m.id=message_id));
alter policy "chat media members can read" on storage.objects to authenticated using(
 bucket_id='chat-media' and exists(select 1 from public.conversation_members cm where cm.conversation_id::text=(storage.foldername(name))[1] and cm.user_id=(select auth.uid()))
 and ((storage.foldername(name))[2]=(select auth.uid())::text or exists(select 1 from public.chat_attachments a join public.chat_messages m on m.id=a.message_id where a.object_path=name))
);
create or replace function public.send_chat_advanced(target_conversation_id uuid,operation_id text,message_body text,reply_to_message_id uuid default null,quote_text text default null,expires_seconds integer default null) returns public.chat_messages language plpgsql security definer set search_path='' as $$
declare msg public.chat_messages;parent_body text;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if expires_seconds is not null and expires_seconds not between 60 and 2592000 then raise exception 'Expiry must be 1 minute to 30 days';end if;
 if quote_text is not null then
  if length(quote_text) not between 1 and 500 or reply_to_message_id is null then raise exception 'Choose up to 500 characters from a reply';end if;
  select body into parent_body from public.chat_messages where id=reply_to_message_id and conversation_id=target_conversation_id and public.is_conversation_member(conversation_id) and deleted_at is null and recalled_at is null and(expires_at is null or expires_at>now());
  if parent_body is null or strpos(parent_body,quote_text)=0 then raise exception 'Quoted sentence is no longer available';end if;
 end if;
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,message_body,'text',reply_to_message_id);
 update public.chat_messages set reply_excerpt=quote_text,expires_at=case when expires_seconds is null then null else msg.created_at+make_interval(secs=>expires_seconds) end where id=msg.id and sender_id=auth.uid() and reply_excerpt is null and expires_at is null returning * into msg;
 if msg.id is null then select * into msg from public.chat_messages where conversation_id=target_conversation_id and sender_id=auth.uid() and client_operation_id=operation_id;end if;
 return msg;
end;$$;
create or replace function public.expire_my_chat_message(target_message_id uuid,seconds_from_now integer) returns timestamptz language plpgsql security definer set search_path='' as $$
declare result timestamptz;
begin
 if seconds_from_now is null or seconds_from_now not between 60 and 2592000 then raise exception 'Expiry must be 1 minute to 30 days';end if;
 update public.chat_messages set expires_at=now()+make_interval(secs=>seconds_from_now) where id=target_message_id and sender_id=auth.uid() and public.is_conversation_member(conversation_id) and deleted_at is null and recalled_at is null and(expires_at is null or expires_at>now()) returning expires_at into result;
 if result is null then raise exception 'Message unavailable';end if;return result;
end;$$;
create or replace function public.save_chat_vault(target_message_id uuid,collection_name text,private_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if collection_name is null or length(trim(collection_name)) not between 1 and 80 or private_note is null or length(private_note)>500 then raise exception 'Collection: 1–80 characters; note: up to 500';end if;
 perform public.set_chat_bookmark(target_message_id,true);
 update public.message_bookmarks set collection=trim(collection_name),note=private_note where message_id=target_message_id and user_id=auth.uid();
end;$$;
create or replace function public.search_chat_everything(search_text text default '',sender_username text default null,before_date timestamptz default null,after_date timestamptz default null,content_type text default null,max_results integer default 80) returns table(id uuid,conversation_id uuid,sender_id uuid,body text,created_at timestamptz,message_type text,reply_to uuid,matched_text text) language sql stable security invoker set search_path='' as $$
 select m.id,m.conversation_id,m.sender_id,m.body,m.created_at,m.message_type,m.reply_to,
 coalesce((select left(v.transcript,500) from public.voice_transcripts v where v.message_id=m.id and v.user_id=auth.uid() and length(coalesce(search_text,''))>0 and strpos(lower(v.transcript),lower(search_text))>0 limit 1),(select string_agg(a.file_name,' · ') from public.chat_attachments a where a.message_id=m.id),left(m.body,500))
 from public.chat_messages m where (sender_username is null or m.sender_id=case when sender_username='me' then auth.uid() else(select p.id from public.profiles p where p.username=lower(sender_username)) end)
 and(before_date is null or m.created_at<before_date) and(after_date is null or m.created_at>=after_date)
 and(content_type is null or content_type='link' and m.body~'https?://' or content_type='voice' and(m.message_type='audio' or exists(select 1 from public.voice_transcripts v where v.message_id=m.id and v.user_id=auth.uid())) or exists(select 1 from public.chat_attachments a where a.message_id=m.id and(case content_type when 'pdf' then a.mime_type='application/pdf' when 'image' then a.mime_type like 'image/%' when 'video' then a.mime_type like 'video/%' when 'audio' then a.mime_type like 'audio/%' when 'file' then true else false end)))
 and(coalesce(search_text,'')='' or strpos(lower(m.body),lower(search_text))>0 or exists(select 1 from public.chat_attachments a where a.message_id=m.id and strpos(lower(a.file_name),lower(search_text))>0) or exists(select 1 from public.voice_transcripts v where v.message_id=m.id and v.user_id=auth.uid() and strpos(lower(v.transcript),lower(search_text))>0))
 order by m.created_at desc,m.id desc limit greatest(1,least(coalesce(max_results,80),100));
$$;
revoke all on function public.send_chat_advanced(uuid,text,text,uuid,text,integer),public.expire_my_chat_message(uuid,integer),public.save_chat_vault(uuid,text,text),public.search_chat_everything(text,text,timestamptz,timestamptz,text,integer) from public,anon;
grant execute on function public.send_chat_advanced(uuid,text,text,uuid,text,integer),public.expire_my_chat_message(uuid,integer),public.save_chat_vault(uuid,text,text),public.search_chat_everything(text,text,timestamptz,timestamptz,text,integer) to authenticated;
