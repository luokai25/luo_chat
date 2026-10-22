create table public.chat_bot_rules(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,created_by uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 80),keyword text not null check(length(keyword) between 2 and 80),response text not null default '' check(length(response)<=1000),block_match boolean not null default false,created_at timestamptz not null default now());
alter table public.chat_bot_rules enable row level security;revoke all on public.chat_bot_rules from anon,authenticated;grant select on public.chat_bot_rules to authenticated;
create policy bot_rules_members on public.chat_bot_rules for select to authenticated using(public.is_conversation_member(conversation_id));
create or replace function public.manage_chat_bot_rule(target_conversation_id uuid,rule_name text,match_keyword text,reply_text text,should_block boolean,remove_rule_id uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.conversation_id=target_conversation_id and cm.user_id=auth.uid() and cm.role in('owner','admin') and c.kind='group') then raise exception 'Group admin required';end if;
 if remove_rule_id is not null then delete from public.chat_bot_rules where id=remove_rule_id and conversation_id=target_conversation_id;return;end if;
 if length(trim(rule_name)) not between 1 and 80 or length(trim(match_keyword)) not between 2 and 80 or reply_text is null or length(reply_text)>1000 or should_block is null or(not should_block and length(trim(reply_text))=0) then raise exception 'Enter a name, keyword, and response or moderation action';end if;
 if(select count(*) from public.chat_bot_rules where conversation_id=target_conversation_id)>=20 then raise exception 'Limit: 20 bot rules per group';end if;
 insert into public.chat_bot_rules(conversation_id,created_by,name,keyword,response,block_match) values(target_conversation_id,auth.uid(),trim(rule_name),lower(trim(match_keyword)),reply_text,should_block);
end;$$;
create or replace function public.apply_chat_moderation_rule() returns trigger language plpgsql security definer set search_path='' as $$begin
 if pg_trigger_depth()>1 or exists(select 1 from public.conversation_members where conversation_id=new.conversation_id and user_id=new.sender_id and role in('owner','admin')) then return new;end if;
 if exists(select 1 from public.chat_bot_rules r where r.conversation_id=new.conversation_id and r.block_match and strpos(lower(new.body),r.keyword)>0) then raise exception 'This text matches a group moderation rule';end if;return new;
end;$$;
create trigger chat_moderation_rules before insert on public.chat_messages for each row execute function public.apply_chat_moderation_rule();
create or replace function public.reply_with_chat_bot() returns trigger language plpgsql security definer set search_path='' as $$declare r record;label text;begin
 if pg_trigger_depth()>1 then return new;end if;
 perform 1 from public.conversations where id=new.conversation_id for update;
 if exists(select 1 from public.chat_messages where conversation_id=new.conversation_id and client_operation_id like 'luo-bot-%' and created_at>now()-interval '1 minute') then return new;end if;
 select br.* into r from public.chat_bot_rules br join public.conversation_members cm on cm.conversation_id=br.conversation_id and cm.user_id=br.created_by and cm.role in('owner','admin') where br.conversation_id=new.conversation_id and not br.block_match and strpos(lower(new.body),br.keyword)>0 order by br.created_at,br.id limit 1;
 if not found then return new;end if;
 select username into label from public.profiles where id=r.created_by;
 insert into public.chat_messages(conversation_id,sender_id,body,message_type,reply_to,client_operation_id) values(new.conversation_id,r.created_by,'[Auto-reply: '||r.name||' · configured by @'||label||']'||E'\n'||r.response,'text',new.id,'luo-bot-'||new.id::text);
 return new;
 exception when others then return new;
end;$$;
create trigger chat_bot_auto_reply after insert on public.chat_messages for each row execute function public.reply_with_chat_bot();
create table public.chat_group_digests(conversation_id uuid primary key references public.conversations(id) on delete cascade,configured_by uuid not null references auth.users(id) on delete cascade,cadence text not null check(cadence in('daily','weekly','off')),next_run timestamptz not null,error_text text);
alter table public.chat_group_digests enable row level security;revoke all on public.chat_group_digests from anon,authenticated;grant select on public.chat_group_digests to authenticated;
create policy digest_members_read on public.chat_group_digests for select to authenticated using(public.is_conversation_member(conversation_id));
create or replace function public.configure_chat_group_digest(target_conversation_id uuid,digest_cadence text) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.conversation_id=target_conversation_id and cm.user_id=auth.uid() and cm.role in('owner','admin') and c.kind='group') then raise exception 'Group admin required';end if;
 if digest_cadence not in('daily','weekly','off') or digest_cadence is null then raise exception 'Choose daily, weekly, or off';end if;
 insert into public.chat_group_digests values(target_conversation_id,auth.uid(),digest_cadence,now()+case when digest_cadence='weekly' then interval '7 days' else interval '1 day' end,null) on conflict(conversation_id) do update set cadence=excluded.cadence,configured_by=excluded.configured_by,next_run=excluded.next_run,error_text=null;
end;$$;
create or replace function public.process_chat_group_digests() returns integer language plpgsql security definer set search_path='' as $$declare r record;span interval;total bigint;files bigint;questions bigint;highlights text;made integer:=0;label text;begin
 for r in select * from public.chat_group_digests where cadence<>'off' and next_run<=now() for update skip locked loop
 begin
 span:=case when r.cadence='weekly' then interval '7 days' else interval '1 day' end;
 if not exists(select 1 from public.conversation_members where conversation_id=r.conversation_id and user_id=r.configured_by and role in('owner','admin')) then raise exception 'Configuring admin is no longer an admin';end if;
 select count(*),count(*) filter(where message_type<>'text'),count(*) filter(where body~'[?؟]') into total,files,questions from public.chat_messages where conversation_id=r.conversation_id and created_at>r.next_run-span and created_at<=r.next_run and deleted_at is null and recalled_at is null and(expires_at is null or expires_at>now()) and body not like '[Luo recap%';
 if total>0 then
 select string_agg('- '||excerpt,E'\n') into highlights from(select left(body,180) as excerpt from public.chat_messages where conversation_id=r.conversation_id and created_at>r.next_run-span and created_at<=r.next_run and deleted_at is null and recalled_at is null and(expires_at is null or expires_at>now()) and body not like '[Luo recap%' order by created_at desc limit 8) recent;
 select username into label from public.profiles where id=r.configured_by;
 insert into public.chat_messages(conversation_id,sender_id,body,message_type,client_operation_id) values(r.conversation_id,r.configured_by,'[Luo recap · automatic · configured by @'||label||']'||E'\n'||total||' messages · '||files||' shared files · '||questions||' questions'||E'\nRecent highlights (rules-based, not an AI summary):\n'||coalesce(highlights,''),'text','luo-digest-'||r.conversation_id::text||'-'||extract(epoch from r.next_run)::bigint::text) on conflict do nothing;made:=made+1;
 end if;
 update public.chat_group_digests set next_run=now()+span,error_text=null where conversation_id=r.conversation_id;
 exception when others then update public.chat_group_digests set next_run=now()+interval '1 day',error_text=left(sqlerrm,300) where conversation_id=r.conversation_id;
 end;
 end loop;return made;
end;$$;
revoke all on function public.apply_chat_moderation_rule(),public.reply_with_chat_bot(),public.process_chat_group_digests() from public,anon,authenticated;
grant execute on function public.process_chat_group_digests() to service_role;
revoke all on function public.manage_chat_bot_rule(uuid,text,text,text,boolean,uuid),public.configure_chat_group_digest(uuid,text) from public,anon;
grant execute on function public.manage_chat_bot_rule(uuid,text,text,text,boolean,uuid),public.configure_chat_group_digest(uuid,text) to authenticated;
select cron.schedule('luo-group-digests','*/5 * * * *','select public.process_chat_group_digests();');
