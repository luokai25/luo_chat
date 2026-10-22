create table public.chat_user_blocks(blocker_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
alter table public.chat_user_blocks enable row level security;
create policy blocks_self_read on public.chat_user_blocks for select to authenticated using(blocker_id=(select auth.uid()));
revoke all on public.chat_user_blocks from public,anon,authenticated;
grant select on public.chat_user_blocks to authenticated;
create index chat_user_blocks_blocked_idx on public.chat_user_blocks(blocked_id);

create or replace function public.set_chat_user_block(target_user_id uuid,should_block boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or target_user_id=auth.uid() or not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'Choose another Luo Chat user.';end if;
 if should_block then insert into public.chat_user_blocks(blocker_id,blocked_id) values(auth.uid(),target_user_id) on conflict do nothing;
 else delete from public.chat_user_blocks where blocker_id=auth.uid() and blocked_id=target_user_id;end if;
end;$$;
revoke all on function public.set_chat_user_block(uuid,boolean) from public,anon;
grant execute on function public.set_chat_user_block(uuid,boolean) to authenticated;

create or replace function public.guard_chat_message_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.conversation_members where conversation_id=new.conversation_id and user_id=new.sender_id) then raise exception 'You are not a member of this conversation.' using errcode='42501';end if;
 if exists(select 1 from public.conversations c join public.conversation_members peer on peer.conversation_id=c.id and peer.user_id<>new.sender_id join public.chat_user_blocks b on(b.blocker_id=new.sender_id and b.blocked_id=peer.user_id) or(b.blocker_id=peer.user_id and b.blocked_id=new.sender_id) where c.id=new.conversation_id and c.kind='direct') then raise exception 'Messaging is unavailable for this conversation.' using errcode='42501';end if;
 return new;
end;$$;
create trigger guard_chat_message_delivery before insert on public.chat_messages for each row execute function public.guard_chat_message_delivery();

create or replace function public.get_chat_message_extras(target_message_ids uuid[]) returns table(message_id uuid,reactions jsonb,saved boolean,read_count bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required.';end if;
 if coalesce(cardinality(target_message_ids),0)>200 then raise exception 'Request up to 200 messages.';end if;
 return query select m.id,
 coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.total,'mine',r.mine)) from(select mr.emoji,count(*) total,bool_or(mr.user_id=auth.uid()) mine from public.message_reactions mr where mr.message_id=m.id group by mr.emoji)r),'[]'::jsonb),
 exists(select 1 from public.message_bookmarks b where b.message_id=m.id and b.user_id=auth.uid()),
 case when m.sender_id=auth.uid() then(select count(*) from public.message_receipts receipt left join public.user_chat_settings prefs on prefs.user_id=receipt.user_id where receipt.message_id=m.id and receipt.read_at is not null and coalesce(prefs.read_receipts,true)) else 0::bigint end
 from public.chat_messages m where m.id=any(target_message_ids) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) and public.is_conversation_member(m.conversation_id);
end;$$;
revoke all on function public.get_chat_message_extras(uuid[]) from public,anon;
grant execute on function public.get_chat_message_extras(uuid[]) to authenticated;

create or replace function public.toggle_chat_reaction(target_message_id uuid,reaction text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or reaction is null or reaction not in('👍','❤️','😂','🎉','😮','😢') then raise exception 'Choose a supported reaction.';end if;
 perform 1 from public.chat_messages m where id=target_message_id and public.is_conversation_member(m.conversation_id) and deleted_at is null and recalled_at is null and(expires_at is null or expires_at>now()) for update;
 if not found then raise exception 'Message unavailable.' using errcode='42501';end if;
 delete from public.message_reactions where message_id=target_message_id and user_id=actor and emoji=reaction;
 if found then return false;end if;
 insert into public.message_reactions(message_id,user_id,emoji) values(target_message_id,actor,reaction);return true;
end;$$;
revoke all on function public.toggle_chat_reaction(uuid,text) from public,anon;
grant execute on function public.toggle_chat_reaction(uuid,text) to authenticated;

create or replace function public.set_chat_bookmark(target_message_id uuid,should_save boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required.';end if;
 if not should_save then delete from public.message_bookmarks where user_id=auth.uid() and message_id=target_message_id;return;end if;
 if not exists(select 1 from public.chat_messages m where m.id=target_message_id and public.is_conversation_member(m.conversation_id) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now())) then raise exception 'Message unavailable.' using errcode='42501';end if;
 insert into public.message_bookmarks(user_id,message_id) values(auth.uid(),target_message_id) on conflict(user_id,message_id) do nothing;
end;$$;
revoke all on function public.set_chat_bookmark(uuid,boolean) from public,anon;
grant execute on function public.set_chat_bookmark(uuid,boolean) to authenticated;

create or replace function public.schedule_chat_text(target_conversation_id uuid,message_body text,scheduled_for timestamptz,operation_id uuid,reply_to_message_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.scheduled_messages;
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if message_body is null or length(trim(message_body)) not between 1 and 10000 or scheduled_for is null or scheduled_for<=now() or scheduled_for>now()+interval '1 year' then raise exception 'Choose a future time within one year and a message of 1–10000 characters.';end if;
 if reply_to_message_id is not null and not exists(select 1 from public.chat_messages m where m.id=reply_to_message_id and m.conversation_id=target_conversation_id and m.deleted_at is null and m.recalled_at is null) then raise exception 'Reply target is unavailable.';end if;
 insert into public.scheduled_messages(id,conversation_id,sender_id,body,send_at,reply_to) values(operation_id,target_conversation_id,auth.uid(),message_body,scheduled_for,reply_to_message_id) on conflict(id) do nothing;
 select * into existing from public.scheduled_messages where id=operation_id;
 if existing.sender_id<>auth.uid() or existing.conversation_id<>target_conversation_id or existing.body<>message_body or existing.send_at<>scheduled_for or existing.reply_to is distinct from reply_to_message_id then raise exception 'Schedule operation conflict.';end if;
 return operation_id;
end;$$;
revoke all on function public.schedule_chat_text(uuid,text,timestamptz,uuid,uuid) from public,anon;
grant execute on function public.schedule_chat_text(uuid,text,timestamptz,uuid,uuid) to authenticated;

-- Isolate failures so one invalid/blocked message cannot stop the entire delivery job.
create or replace function public.process_due_scheduled_messages() returns integer language plpgsql security definer set search_path='' as $$
declare item record; new_message_id uuid; sent_count integer:=0;
begin
 for item in select * from public.scheduled_messages where status='pending' and send_at<=now() order by send_at for update skip locked loop
 begin
  if item.reply_to is not null and not exists(select 1 from public.chat_messages where id=item.reply_to and conversation_id=item.conversation_id and deleted_at is null and recalled_at is null) then raise exception 'Reply target is no longer available';end if;
  insert into public.chat_messages(conversation_id,sender_id,body,message_type,reply_to,client_operation_id) values(item.conversation_id,item.sender_id,item.body,item.message_type,item.reply_to,'scheduled-'||item.id::text) returning id into new_message_id;
  update public.scheduled_messages set status='sent',sent_message_id=new_message_id,sent_at=now(),error_text=null where id=item.id;sent_count:=sent_count+1;
 exception when others then update public.scheduled_messages set status='failed',error_text=left(SQLERRM,500) where id=item.id;
 end;end loop;return sent_count;
end;$$;
revoke all on function public.process_due_scheduled_messages() from public,anon,authenticated;
grant execute on function public.process_due_scheduled_messages() to service_role;

create or replace function public.set_chat_privacy(show_read_receipts boolean,show_typing boolean,text_scale numeric,reduced_motion boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or text_scale is null or text_scale not between 0.8 and 1.5 then raise exception 'Invalid preferences.';end if;
 insert into public.user_chat_settings(user_id,read_receipts,typing_indicators,font_scale,reduce_motion) values(auth.uid(),show_read_receipts,show_typing,text_scale,reduced_motion) on conflict(user_id) do update set read_receipts=excluded.read_receipts,typing_indicators=excluded.typing_indicators,font_scale=excluded.font_scale,reduce_motion=excluded.reduce_motion,updated_at=now();
 if not show_typing then delete from public.conversation_presence where user_id=auth.uid();end if;
end;$$;
revoke all on function public.set_chat_privacy(boolean,boolean,numeric,boolean) from public,anon;
grant execute on function public.set_chat_privacy(boolean,boolean,numeric,boolean) to authenticated;

create or replace function public.set_chat_presence(target_conversation_id uuid,is_typing boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if not coalesce((select typing_indicators from public.user_chat_settings where user_id=auth.uid()),true) then return;end if;
 insert into public.conversation_presence(conversation_id,user_id,presence_state,last_active_at,updated_at) values(target_conversation_id,auth.uid(),case when is_typing then 'typing' else 'online' end,now(),now()) on conflict(conversation_id,user_id) do update set presence_state=excluded.presence_state,last_active_at=now(),updated_at=now();
end;$$;
revoke all on function public.set_chat_presence(uuid,boolean) from public,anon;
grant execute on function public.set_chat_presence(uuid,boolean) to authenticated;
