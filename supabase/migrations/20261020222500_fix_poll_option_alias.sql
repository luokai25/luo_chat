CREATE OR REPLACE FUNCTION public.create_chat_poll(target_message_id uuid, poll_question text, option_texts text[], poll_kind text DEFAULT 'poll'::text, allow_multiple boolean DEFAULT false, hide_voters boolean DEFAULT false, poll_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone, correct_option_indexes integer[] DEFAULT '{}'::integer[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid; message_row public.chat_messages; new_poll_id uuid; opt record;
begin
 caller_id := (select auth.uid());
 if caller_id is null then raise exception 'Authentication required'; end if;
 if poll_question is null or char_length(btrim(poll_question)) not between 1 and 500 then raise exception 'Poll question must be 1–500 characters'; end if;
 if poll_kind not in ('poll','quiz','question') then raise exception 'Invalid poll kind'; end if;
 if coalesce(array_length(option_texts,1),0) < 2 or array_length(option_texts,1)>12 then raise exception 'A poll must have 2–12 options'; end if;
 if poll_closes_at is not null and poll_closes_at<=now() then raise exception 'Poll closing time must be in the future'; end if;
 select * into message_row from public.chat_messages m where m.id=target_message_id and m.sender_id=caller_id and m.deleted_at is null;
 if message_row.id is null or not public.is_conversation_member(message_row.conversation_id) then raise exception 'Message not found or access denied'; end if;
 if exists(select 1 from unnest(option_texts) x where char_length(btrim(x)) not between 1 and 300) then raise exception 'Each option must be 1–300 characters'; end if;
 if exists(select 1 from unnest(coalesce(correct_option_indexes,'{}'::integer[])) i where i<1 or i>array_length(option_texts,1)) then raise exception 'Correct option index is invalid'; end if;
 insert into public.chat_polls(message_id,conversation_id,created_by,question,poll_kind,multiple_choice,anonymous,closes_at)
 values(target_message_id,message_row.conversation_id,caller_id,btrim(poll_question),poll_kind,allow_multiple,hide_voters,poll_closes_at)
 returning id into new_poll_id;
 for opt in select value, ordinality::integer as pos from unnest(option_texts) with ordinality as u(value, ordinality)
 loop
  insert into public.chat_poll_options(poll_id,option_text,sort_order)
  values(new_poll_id,btrim(opt.value),opt.pos);
 end loop;
 if poll_kind='quiz' then
  insert into public.chat_poll_correct_answers(poll_id,option_id,created_by)
  select new_poll_id,o.id,caller_id from public.chat_poll_options o
  where o.poll_id=new_poll_id and o.sort_order=any(coalesce(correct_option_indexes,'{}'::integer[]));
 end if;
 return new_poll_id;
end;
$function$
;
