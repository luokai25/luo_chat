alter table public.chat_group_rules add column member_invites boolean not null default false,add column member_details boolean not null default false,add column archive_at timestamptz,add column archived boolean not null default false;
-- Keep the original RPC compatible with existing clients after adding columns.
create or replace function public.set_chat_group_rules(target_conversation_id uuid,allow_text boolean,allow_files boolean,allow_replies boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.conversation_id=target_conversation_id and cm.user_id=auth.uid() and cm.role in('owner','admin') and c.kind='group') then raise exception 'Group admin required';end if;
 if allow_text is null or allow_files is null or allow_replies is null then raise exception 'Choose all permissions';end if;
 insert into public.chat_group_rules(conversation_id,member_text,member_files,member_replies) values(target_conversation_id,allow_text,allow_files,allow_replies) on conflict(conversation_id) do update set member_text=excluded.member_text,member_files=excluded.member_files,member_replies=excluded.member_replies,updated_at=now();
end;$$;
create or replace function public.set_chat_advanced_group_rules(target_conversation_id uuid,allow_text boolean,allow_files boolean,allow_replies boolean,allow_invites boolean,allow_details boolean,archive_time timestamptz default null) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.set_chat_group_rules(target_conversation_id,allow_text,allow_files,allow_replies);
 if allow_invites is null or allow_details is null or archive_time<=now() then raise exception 'Choose valid permissions and a future archive time';end if;
 update public.chat_group_rules set member_invites=allow_invites,member_details=allow_details,archive_at=archive_time,archived=false where conversation_id=target_conversation_id;
end;$$;
create or replace function public.guard_group_chat_permissions() returns trigger language plpgsql security definer set search_path='' as $$declare rules public.chat_group_rules;begin
 select * into rules from public.chat_group_rules where conversation_id=new.conversation_id;
 if not found then return new;end if;
 if rules.archived or rules.archive_at<=now() then raise exception 'This temporary group is archived. An admin must reopen it before posting';end if;
 if exists(select 1 from public.conversation_members where conversation_id=new.conversation_id and user_id=new.sender_id and role in('owner','admin')) then return new;end if;
 if new.message_type<>'text' and not rules.member_files then raise exception 'Only admins can share files in this group';end if;
 if new.message_type='text' and not rules.member_text and not(rules.member_replies and new.reply_to is not null) then raise exception 'Announcement mode: only admins can post; reply to an existing message if allowed';end if;return new;
end;$$;
create or replace function public.update_chat_group_details(target_conversation_id uuid,new_title text default null,invite_username text default null) returns void language plpgsql security definer set search_path='' as $$declare actor_role text;rules public.chat_group_rules;target uuid;begin
 select cm.role into actor_role from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.conversation_id=target_conversation_id and cm.user_id=auth.uid() and c.kind='group';
 if actor_role is null then raise exception 'Group unavailable';end if;
 select * into rules from public.chat_group_rules where conversation_id=target_conversation_id;
 if new_title is not null then
  if actor_role not in('owner','admin') and not coalesce(rules.member_details,false) then raise exception 'Only admins may change group details';end if;
  if length(trim(new_title)) not between 1 and 100 then raise exception 'Group title must be 1–100 characters';end if;
  update public.conversations set title=trim(new_title) where id=target_conversation_id;
 end if;
 if invite_username is not null then
  if actor_role not in('owner','admin') and not coalesce(rules.member_invites,false) then raise exception 'Only admins may invite members';end if;
  select id into target from public.profiles where username=lower(trim(invite_username));if target is null then raise exception 'Exact username not found';end if;
  insert into public.conversation_members(conversation_id,user_id,role) values(target_conversation_id,target,'member') on conflict do nothing;
 end if;
end;$$;
create or replace function public.archive_due_chat_groups() returns integer language plpgsql security definer set search_path='' as $$declare r record;n integer:=0;begin
 for r in update public.chat_group_rules set archived=true where not archived and archive_at<=now() returning conversation_id loop
 insert into public.user_conversation_settings(user_id,conversation_id,archived) select user_id,conversation_id,true from public.conversation_members where conversation_id=r.conversation_id on conflict(user_id,conversation_id) do update set archived=true;
 n:=n+1;end loop;return n;
end;$$;
revoke all on function public.archive_due_chat_groups() from public,anon,authenticated;grant execute on function public.archive_due_chat_groups() to service_role;
select cron.schedule('luo-temporary-group-archive','* * * * *','select public.archive_due_chat_groups();');
create table public.chat_group_tasks(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,created_by uuid not null references auth.users(id) on delete cascade,assigned_to uuid references auth.users(id) on delete set null,title text not null check(length(title) between 1 and 300),due_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now());
alter table public.chat_group_tasks enable row level security;revoke all on public.chat_group_tasks from anon,authenticated;grant select on public.chat_group_tasks to authenticated;
create policy group_tasks_member_read on public.chat_group_tasks for select to authenticated using(public.is_conversation_member(conversation_id));
create or replace function public.create_chat_group_task(target_conversation_id uuid,task_title text,assignee_username text,due_time timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$declare target uuid;result uuid;begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) or length(trim(task_title)) not between 1 and 300 then raise exception 'Enter a valid task in a joined conversation';end if;
 if coalesce(trim(assignee_username),'')<>'' then select p.id into target from public.profiles p join public.conversation_members cm on cm.user_id=p.id where p.username=lower(trim(assignee_username)) and cm.conversation_id=target_conversation_id;if target is null then raise exception 'Assignee must be a member';end if;end if;
 insert into public.chat_group_tasks(conversation_id,created_by,assigned_to,title,due_at) values(target_conversation_id,auth.uid(),target,trim(task_title),due_time) returning id into result;return result;
end;$$;
create or replace function public.complete_chat_group_task(target_task_id uuid,is_complete boolean) returns void language plpgsql security definer set search_path='' as $$declare task public.chat_group_tasks;begin
 select * into task from public.chat_group_tasks where id=target_task_id for update;
 if task.id is null or auth.uid() is null or not public.is_conversation_member(task.conversation_id) or not(auth.uid()=task.created_by or(task.assigned_to is not null and auth.uid()=task.assigned_to) or exists(select 1 from public.conversation_members where conversation_id=task.conversation_id and user_id=auth.uid() and role in('owner','admin'))) then raise exception 'Only the assignee, creator, or an admin can complete this task';end if;
 update public.chat_group_tasks set completed_at=case when is_complete then now() else null end where id=target_task_id;
end;$$;
create table public.chat_event_rsvps(event_id uuid not null references public.chat_events(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,response text not null check(response in('going','maybe','declined')),primary key(event_id,user_id));
alter table public.chat_event_rsvps enable row level security;revoke all on public.chat_event_rsvps from anon,authenticated;grant select,insert,update on public.chat_event_rsvps to authenticated;
create policy rsvp_member_read on public.chat_event_rsvps for select to authenticated using(exists(select 1 from public.chat_events e where e.id=event_id and public.is_conversation_member(e.conversation_id)));
create policy rsvp_own_insert on public.chat_event_rsvps for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.chat_events e where e.id=event_id and public.is_conversation_member(e.conversation_id)));
create policy rsvp_own_update on public.chat_event_rsvps for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.chat_events e where e.id=event_id and public.is_conversation_member(e.conversation_id)));
revoke all on function public.set_chat_advanced_group_rules(uuid,boolean,boolean,boolean,boolean,boolean,timestamptz),public.update_chat_group_details(uuid,text,text),public.create_chat_group_task(uuid,text,text,timestamptz),public.complete_chat_group_task(uuid,boolean) from public,anon;
grant execute on function public.set_chat_advanced_group_rules(uuid,boolean,boolean,boolean,boolean,boolean,timestamptz),public.update_chat_group_details(uuid,text,text),public.create_chat_group_task(uuid,text,text,timestamptz),public.complete_chat_group_task(uuid,boolean) to authenticated;
