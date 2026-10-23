create or replace function public.start_direct_chat(target_username text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();other_user uuid;existing_id uuid;new_id uuid;
 normalized_username text:=lower(trim(coalesce(target_username,'')));
begin
 if me is null then raise exception 'Sign in to start a chat.' using errcode='28000';end if;
 if normalized_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'Usernames must be 3–24 characters and use only letters, numbers, or underscores.' using errcode='22023';end if;
 select p.id into other_user from public.profiles p where lower(p.username)=normalized_username;
 if other_user is null then raise exception 'No Luo Chat user was found with that username. Check the spelling and try again.' using errcode='P0002';end if;
 if other_user=me then raise exception 'You cannot start a chat with your own account.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(me,other_user)::text||':'||greatest(me,other_user)::text,4721));
 if exists(select 1 from public.chat_user_blocks where(blocker_id=me and blocked_id=other_user)or(blocker_id=other_user and blocked_id=me)) then raise exception 'Direct chat unavailable';end if;
 select c.id into existing_id from public.conversations c
 join public.conversation_members a on a.conversation_id=c.id and a.user_id=me
 join public.conversation_members b on b.conversation_id=c.id and b.user_id=other_user
 where c.kind='direct' and(select count(*) from public.conversation_members allm where allm.conversation_id=c.id)=2
 order by c.created_at,c.id limit 1;
 if existing_id is not null then return existing_id;end if;
 insert into public.conversations(kind,created_by) values('direct',me) returning id into new_id;
 insert into public.conversation_members(conversation_id,user_id,role) values(new_id,me,'owner'),(new_id,other_user,'member');
 return new_id;
end;$$;
