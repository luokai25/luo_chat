-- All client attachment metadata must pass the checked upload RPC.
revoke insert,update,delete on public.chat_attachments from public,anon,authenticated;
create or replace function public.send_chat_attachment(target_conversation_id uuid,operation_id text,message_body text,reply_to_message_id uuid,uploaded_path text,uploaded_name text,uploaded_type text,uploaded_bytes bigint,uploaded_checksum text) returns public.chat_messages language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();stored storage.objects;msg public.chat_messages;kind text;
begin
 if actor is null or not public.is_conversation_member(target_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if uploaded_path is distinct from target_conversation_id::text||'/'||actor::text||'/'||operation_id then raise exception 'Invalid upload path.';end if;
 if uploaded_name is null or length(trim(uploaded_name)) not between 1 and 255 or uploaded_bytes is null or uploaded_bytes not between 1 and 52428800 or uploaded_checksum is null or uploaded_checksum !~ '^[0-9a-f]{64}$' then raise exception 'Invalid attachment metadata.';end if;
 if uploaded_type is null or uploaded_type not in('image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/ogg','audio/webm','video/mp4','video/webm','application/pdf','text/plain') then raise exception 'Unsupported attachment type.';end if;
 select * into stored from storage.objects where bucket_id='chat-media' and name=uploaded_path;
 if stored.id is null or coalesce(stored.owner_id,stored.owner::text) is distinct from actor::text or stored.metadata->>'mimetype' is distinct from uploaded_type or(stored.metadata->>'size')::bigint is distinct from uploaded_bytes or stored.user_metadata->>'checksum' is distinct from uploaded_checksum then raise exception 'Upload is incomplete or does not match this file.';end if;
 kind:=case when uploaded_type like 'image/%' then 'image' when uploaded_type like 'audio/%' then 'audio' else 'file' end;
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,message_body,kind,reply_to_message_id);
 perform 1 from public.chat_messages where id=msg.id for update;
 if exists(select 1 from public.chat_attachments a where a.message_id=msg.id and(a.object_path<>uploaded_path or a.checksum is distinct from uploaded_checksum)) then raise exception 'Attachment retry conflicts with an existing file.';end if;
 if not exists(select 1 from public.chat_attachments where message_id=msg.id and object_path=uploaded_path) then insert into public.chat_attachments(message_id,conversation_id,uploader_id,object_path,file_name,mime_type,byte_size,checksum) values(msg.id,target_conversation_id,actor,uploaded_path,uploaded_name,uploaded_type,uploaded_bytes,uploaded_checksum);end if;
 return msg;
end;$$;
revoke all on function public.send_chat_attachment(uuid,text,text,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.send_chat_attachment(uuid,text,text,uuid,text,text,text,bigint,text) to authenticated;

-- Recall deliberately transitions a visible row into one SELECT RLS must hide.
-- This checked write boundary must not grant clients arbitrary message UPDATE access.
create or replace function public.recall_own_message(target_message_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 update public.chat_messages set recalled_at=now(),deleted_at=now(),body='Message recalled'
 where id=target_message_id and sender_id=actor
 and public.is_conversation_member(conversation_id)
 and deleted_at is null and recalled_at is null
 and(expires_at is null or expires_at>now());
 return found;
end;$$;
revoke all on function public.recall_own_message(uuid) from public,anon;
grant execute on function public.recall_own_message(uuid) to authenticated;
