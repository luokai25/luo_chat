create or replace function public.create_chat_simple_poll(target_conversation_id uuid,poll_question text,option_texts text[],operation_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare msg public.chat_messages;pid uuid;message_text text;
begin
 if coalesce(cardinality(option_texts),0) not between 2 and 8 or exists(select 1 from unnest(option_texts)o where o is null or length(trim(o)) not between 1 and 300) or poll_question is null or length(trim(poll_question)) not between 1 and 500 then raise exception 'Enter a question and 2–8 options.';end if;
 if(select count(distinct lower(trim(o))) from unnest(option_texts)o)<>cardinality(option_texts) then raise exception 'Poll options must be different.';end if;
 message_text:='Poll: '||trim(poll_question)||E'\n'||array_to_string(option_texts,E'\n');
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,message_text,'text',null);
 perform 1 from public.chat_messages where id=msg.id for update;
 select id into pid from public.chat_polls where message_id=msg.id;
 if pid is null then pid:=public.create_chat_poll(msg.id,poll_question,option_texts,'poll',false,false,null,'{}'::integer[]);end if;
 return msg.id;
end;$$;
revoke all on function public.create_chat_simple_poll(uuid,text,text[],text) from public,anon;
grant execute on function public.create_chat_simple_poll(uuid,text,text[],text) to authenticated;
create or replace function public.get_chat_polls(target_message_ids uuid[]) returns table(message_id uuid,poll_id uuid,question text,options jsonb,closed boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(cardinality(target_message_ids),0)>200 then raise exception 'Invalid request.';end if;
 return query select m.id,p.id,p.question,
 coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'text',o.option_text,'count',(select count(*) from public.chat_poll_votes v where v.poll_id=p.id and v.option_id=o.id),'mine',exists(select 1 from public.chat_poll_votes v where v.poll_id=p.id and v.option_id=o.id and v.user_id=auth.uid())) order by o.sort_order) from public.chat_poll_options o where o.poll_id=p.id),'[]'::jsonb),
 p.closes_at is not null and p.closes_at<=now()
 from public.chat_polls p join public.chat_messages m on m.id=p.message_id where m.id=any(target_message_ids) and public.is_conversation_member(m.conversation_id) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now());
end;$$;
revoke all on function public.get_chat_polls(uuid[]) from public,anon;
grant execute on function public.get_chat_polls(uuid[]) to authenticated;
create or replace function public.vote_chat_simple_poll(target_poll_id uuid,target_option_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.chat_polls p join public.chat_messages m on m.id=p.message_id where p.id=target_poll_id and public.is_conversation_member(p.conversation_id) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now())) then raise exception 'Poll unavailable.' using errcode='42501';end if;
 perform public.cast_chat_poll_vote(target_poll_id,array[target_option_id]);
end;$$;
revoke all on function public.vote_chat_simple_poll(uuid,uuid) from public,anon;
grant execute on function public.vote_chat_simple_poll(uuid,uuid) to authenticated;
