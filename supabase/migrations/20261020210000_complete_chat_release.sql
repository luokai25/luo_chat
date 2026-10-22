-- Preserve shared conversations when a creator deletes their account.
alter table public.conversations alter column created_by drop not null;
alter table public.conversations drop constraint conversations_created_by_fkey;
alter table public.conversations add constraint conversations_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;

create or replace function public.get_my_chat_previews()
returns table(id uuid,conversation_id uuid,body text,created_at timestamptz,sender_id uuid)
language sql stable security definer set search_path='' as $$
 select msg.id,c.id,msg.body,msg.created_at,msg.sender_id
 from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=(select auth.uid())
 left join lateral(select m.id,m.body,m.created_at,m.sender_id from public.chat_messages m where m.conversation_id=c.id and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) order by m.created_at desc,m.id desc limit 1) msg on true;
$$;
revoke all on function public.get_my_chat_previews() from public,anon;
grant execute on function public.get_my_chat_previews() to authenticated;

create or replace function public.manage_chat_group(target_conversation_id uuid,action text,target_username text default null,target_user_id uuid default null,new_role text default null,new_title text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role text; person uuid; target_role text;
begin
 if actor is null then raise exception 'Sign in required.' using errcode='28000'; end if;
 perform 1 from public.conversations where id=target_conversation_id and kind='group' for update;
 if not found then raise exception 'Group not found.'; end if;
 select role into actor_role from public.conversation_members where conversation_id=target_conversation_id and user_id=actor;
 if actor_role is null or actor_role not in('owner','admin') then raise exception 'Group administrator required.' using errcode='42501'; end if;
 if action='rename' then
  if new_title is null or length(trim(new_title)) not between 1 and 100 then raise exception 'Use a group name of 1–100 characters.';end if;
  update public.conversations set title=trim(new_title) where id=target_conversation_id;
 elsif action='add' then
  select id into person from public.profiles where username=lower(trim(target_username));
  if person is null then raise exception 'Username not found.';end if;
  insert into public.conversation_members(conversation_id,user_id,role) values(target_conversation_id,person,'member') on conflict(conversation_id,user_id) do nothing;
 elsif action='role' then
  if actor_role<>'owner' then raise exception 'Only the owner can change roles.' using errcode='42501';end if;
  if target_user_id=actor or new_role is null or new_role not in('admin','member') then raise exception 'Invalid role change.';end if;
  select role into target_role from public.conversation_members where conversation_id=target_conversation_id and user_id=target_user_id;
  if target_role is null or target_role='owner' then raise exception 'Target member not eligible.';end if;
  update public.conversation_members set role=new_role where conversation_id=target_conversation_id and user_id=target_user_id;
 else raise exception 'Unknown group action.';end if;
end;$$;
revoke all on function public.manage_chat_group(uuid,text,text,uuid,text,text) from public,anon;
grant execute on function public.manage_chat_group(uuid,text,text,uuid,text,text) to authenticated;

-- Only the deletion function service may make this check. No direct browser access.
create or replace function public.check_chat_account_deletion(target_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.user_id=target_user_id and cm.role='owner' and c.kind='group' and exists(select 1 from public.conversation_members other where other.conversation_id=c.id and other.user_id<>target_user_id)) then
 raise exception 'Transfer ownership of your groups before deleting your account.';end if;
end;$$;
revoke all on function public.check_chat_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.check_chat_account_deletion(uuid) to service_role;
