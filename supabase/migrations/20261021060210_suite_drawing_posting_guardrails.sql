create function public.can_write_luo_room(target_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.is_conversation_member(target_room) and exists(select 1 from public.conversations c where c.id=target_room and case when c.kind='direct' then not exists(select 1 from public.conversation_members cm join public.chat_user_blocks b on (b.blocker_id=auth.uid() and b.blocked_id=cm.user_id)or(b.blocker_id=cm.user_id and b.blocked_id=auth.uid()) where cm.conversation_id=c.id and cm.user_id<>auth.uid()) else coalesce((select member_text from public.chat_group_rules where conversation_id=c.id),true) or exists(select 1 from public.conversation_members where conversation_id=c.id and user_id=auth.uid() and role in('owner','admin')) end);
$$;
revoke all on function public.can_write_luo_room(uuid) from public,anon;grant execute on function public.can_write_luo_room(uuid) to authenticated;
alter policy drawing_board_member_create on public.chat_drawing_boards with check(created_by=(select auth.uid()) and public.can_write_luo_room(conversation_id));
create function luo_internal.guard_drawing_stroke() returns trigger language plpgsql security definer set search_path='' as $$declare room uuid;begin
 select conversation_id into room from public.chat_drawing_boards where id=new.board_id;if new.user_id is distinct from auth.uid() or not public.can_write_luo_room(room) then raise exception 'Drawing permission denied';end if;return new;end;$$;
revoke all on function luo_internal.guard_drawing_stroke() from public,anon,authenticated;
create trigger guard_drawing_stroke before insert on public.chat_drawing_strokes for each row execute function luo_internal.guard_drawing_stroke();
create function luo_internal.bound_drawing_boards() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text,71));if(select count(*) from public.chat_drawing_boards where conversation_id=new.conversation_id)>=50 then raise exception 'Maximum 50 boards per conversation';end if;return new;end;$$;
revoke all on function luo_internal.bound_drawing_boards() from public,anon,authenticated;
create trigger bound_drawing_boards before insert on public.chat_drawing_boards for each row execute function luo_internal.bound_drawing_boards();
