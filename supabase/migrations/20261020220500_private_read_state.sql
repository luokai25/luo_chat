create table public.chat_private_read_markers(user_id uuid not null references auth.users(id) on delete cascade,conversation_id uuid not null references public.conversations(id) on delete cascade,read_through timestamptz not null,primary key(user_id,conversation_id));
alter table public.chat_private_read_markers enable row level security;
create policy own_read_marker on public.chat_private_read_markers for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.chat_private_read_markers from public,anon,authenticated;
grant select on public.chat_private_read_markers to authenticated;
create index chat_private_read_markers_conversation_idx on public.chat_private_read_markers(conversation_id);
insert into public.chat_private_read_markers(user_id,conversation_id,read_through) select user_id,conversation_id,last_read_at from public.conversation_members where last_read_at is not null;

create or replace function public.mark_conversation_read(target_conversation_id uuid,through_message_id uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); cutoff timestamptz:=now(); changed integer:=0; share_receipts boolean;
begin
 if actor is null or not public.is_conversation_member(target_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if through_message_id is not null then select created_at into cutoff from public.chat_messages where id=through_message_id and conversation_id=target_conversation_id and deleted_at is null and recalled_at is null; if cutoff is null then raise exception 'Read-through message unavailable.';end if;end if;
 insert into public.chat_private_read_markers(user_id,conversation_id,read_through) values(actor,target_conversation_id,cutoff) on conflict(user_id,conversation_id) do update set read_through=greatest(public.chat_private_read_markers.read_through,excluded.read_through);
 select coalesce((select read_receipts from public.user_chat_settings where user_id=actor),true) into share_receipts;
 if share_receipts then
 insert into public.message_receipts(message_id,user_id,delivered_at,read_at) select m.id,actor,now(),now() from public.chat_messages m where m.conversation_id=target_conversation_id and m.sender_id<>actor and m.created_at<=cutoff and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) on conflict(message_id,user_id) do update set read_at=coalesce(public.message_receipts.read_at,excluded.read_at),delivered_at=coalesce(public.message_receipts.delivered_at,excluded.delivered_at);
 get diagnostics changed=row_count;
 end if;return changed;
end;$$;
create or replace function public.get_my_conversation_unread_counts() returns table(conversation_id uuid,unread_count bigint,last_message_at timestamptz) language sql stable security definer set search_path='' as $$
 select cm.conversation_id,count(m.id)::bigint,c.last_message_at from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id left join public.chat_private_read_markers marker on marker.user_id=cm.user_id and marker.conversation_id=cm.conversation_id left join public.chat_messages m on m.conversation_id=cm.conversation_id and m.sender_id<>auth.uid() and m.created_at>coalesce(marker.read_through,cm.last_read_at,'-infinity'::timestamptz) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) where cm.user_id=auth.uid() group by cm.conversation_id,c.last_message_at order by c.last_message_at desc;
$$;
create or replace function public.set_chat_privacy(show_read_receipts boolean,show_typing boolean,text_scale numeric,reduced_motion boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or show_read_receipts is null or show_typing is null or reduced_motion is null or text_scale is null or text_scale not between 0.8 and 1.5 then raise exception 'Invalid preferences.';end if;
 insert into public.user_chat_settings(user_id,read_receipts,typing_indicators,font_scale,reduce_motion) values(auth.uid(),show_read_receipts,show_typing,text_scale,reduced_motion) on conflict(user_id) do update set read_receipts=excluded.read_receipts,typing_indicators=excluded.typing_indicators,font_scale=excluded.font_scale,reduce_motion=excluded.reduce_motion,updated_at=now();
 if not show_typing then delete from public.conversation_presence where user_id=auth.uid();end if;
 if not show_read_receipts then delete from public.message_receipts where user_id=auth.uid();update public.conversation_members set last_read_at=null where user_id=auth.uid();end if;
end;$$;
-- A user cannot bypass their receipt preference through a direct Data API write.
drop policy if exists receipts_insert_self on public.message_receipts;
drop policy if exists receipts_update_self on public.message_receipts;
revoke insert,update,delete on public.message_receipts from authenticated;
revoke all on function public.guard_chat_message_delivery() from public,anon,authenticated;
