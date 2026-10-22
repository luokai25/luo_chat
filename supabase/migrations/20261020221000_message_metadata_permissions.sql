revoke insert,update,delete on public.message_reactions,public.message_bookmarks,public.scheduled_messages from authenticated;
create or replace function public.cancel_scheduled_message(schedule_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required.';end if;
 update public.scheduled_messages set status='cancelled' where id=schedule_id and sender_id=auth.uid() and status='pending';return found;
end;$$;
revoke all on function public.cancel_scheduled_message(uuid) from public,anon;
grant execute on function public.cancel_scheduled_message(uuid) to authenticated;
