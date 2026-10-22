create or replace function public.send_chat_attachment(target_conversation_id uuid,operation_id text,message_body text,reply_to_message_id uuid,uploaded_path text,uploaded_name text,uploaded_type text,uploaded_bytes bigint,uploaded_checksum text) returns public.chat_messages language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();stored storage.objects;msg public.chat_messages;kind text;
begin
 if actor is null or not public.is_conversation_member(target_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if uploaded_path is distinct from target_conversation_id::text||'/'||actor::text||'/'||operation_id then raise exception 'Invalid upload path.';end if;
 if uploaded_name is null or length(trim(uploaded_name)) not between 1 and 255 or uploaded_bytes is null or uploaded_bytes not between 1 and 52428800 or uploaded_checksum is null or uploaded_checksum !~ '^[0-9a-f]{64}$' then raise exception 'Invalid attachment metadata.';end if;
 if uploaded_type is null or uploaded_type not in('image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/ogg','audio/webm','video/mp4','video/webm','application/pdf','text/plain') then raise exception 'Unsupported attachment type.';end if;
 select * into stored from storage.objects where bucket_id='chat-media' and name=uploaded_path;
 if stored.id is null or coalesce(stored.owner_id,stored.owner::text)<>actor::text or(stored.metadata->>'size')::bigint is distinct from uploaded_bytes or stored.user_metadata->>'checksum' is distinct from uploaded_checksum then raise exception 'Upload is incomplete or does not match this file.';end if;
 kind:=case when uploaded_type like 'image/%' then 'image' when uploaded_type like 'audio/%' then 'audio' else 'file' end;
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,message_body,kind,reply_to_message_id);
 perform 1 from public.chat_messages where id=msg.id for update;
 if exists(select 1 from public.chat_attachments a where a.message_id=msg.id and(a.object_path<>uploaded_path or a.checksum is distinct from uploaded_checksum)) then raise exception 'Attachment retry conflicts with an existing file.';end if;
 if not exists(select 1 from public.chat_attachments where message_id=msg.id and object_path=uploaded_path) then insert into public.chat_attachments(message_id,conversation_id,uploader_id,object_path,file_name,mime_type,byte_size,checksum) values(msg.id,target_conversation_id,actor,uploaded_path,uploaded_name,uploaded_type,uploaded_bytes,uploaded_checksum);end if;
 return msg;
end;$$;
revoke all on function public.send_chat_attachment(uuid,text,text,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.send_chat_attachment(uuid,text,text,uuid,text,text,text,bigint,text) to authenticated;
