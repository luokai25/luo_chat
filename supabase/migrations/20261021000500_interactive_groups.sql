create table public.chat_group_rules(conversation_id uuid primary key references public.conversations(id) on delete cascade,member_text boolean not null default true,member_files boolean not null default true,member_replies boolean not null default true,updated_at timestamptz not null default now());
alter table public.chat_group_rules enable row level security;
revoke all on public.chat_group_rules from anon,authenticated;grant select on public.chat_group_rules to authenticated;
create policy rules_member_read on public.chat_group_rules for select to authenticated using(public.is_conversation_member(conversation_id));
create or replace function public.set_chat_group_rules(target_conversation_id uuid,allow_text boolean,allow_files boolean,allow_replies boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.conversation_id=target_conversation_id and cm.user_id=auth.uid() and cm.role in ('owner','admin') and c.kind='group') then raise exception 'Group admin required';end if;
 if allow_text is null or allow_files is null or allow_replies is null then raise exception 'Choose all permissions';end if;
 insert into public.chat_group_rules values(target_conversation_id,allow_text,allow_files,allow_replies,now()) on conflict(conversation_id) do update set member_text=excluded.member_text,member_files=excluded.member_files,member_replies=excluded.member_replies,updated_at=now();
end;$$;
create or replace function public.guard_group_chat_permissions() returns trigger language plpgsql security definer set search_path='' as $$
declare rules public.chat_group_rules;
begin
 if exists(select 1 from public.conversation_members where conversation_id=new.conversation_id and user_id=new.sender_id and role in ('owner','admin')) then return new;end if;
 select * into rules from public.chat_group_rules where conversation_id=new.conversation_id;
 if not found then return new;end if;
 if new.message_type<>'text' and not rules.member_files then raise exception 'Only admins can share files in this group';end if;
 if new.message_type='text' and not rules.member_text and not(rules.member_replies and new.reply_to is not null) then raise exception 'Announcement mode: only admins can post; reply to an existing message if allowed';end if;
 return new;
end;$$;
revoke all on function public.guard_group_chat_permissions() from public,anon,authenticated;
create trigger group_chat_permissions before insert on public.chat_messages for each row execute function public.guard_group_chat_permissions();
create table public.chat_living_messages(message_id uuid primary key references public.chat_messages(id) on delete cascade,conversation_id uuid not null references public.conversations(id) on delete cascade,kind text not null check(kind in ('checklist','countdown','note')),payload jsonb not null,version integer not null default 1,created_by uuid not null references auth.users(id) on delete cascade);
alter table public.chat_living_messages enable row level security;revoke all on public.chat_living_messages from anon,authenticated;grant select on public.chat_living_messages to authenticated;
create policy living_member_read on public.chat_living_messages for select to authenticated using(public.is_conversation_member(conversation_id) and exists(select 1 from public.chat_messages m where m.id=message_id));
create or replace function public.create_chat_living_message(target_conversation_id uuid,card_kind text,card_payload jsonb,operation_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare msg public.chat_messages;title text;
begin
 if auth.uid() is null or card_kind not in ('checklist','countdown','note') or jsonb_typeof(card_payload)<>'object' or octet_length(card_payload::text)>16000 then raise exception 'Invalid interactive message';end if;
 title:=trim(coalesce(card_payload->>'title',''));
 if length(title) not between 1 and 160 then raise exception 'Enter a title up to 160 characters';end if;
 if card_kind='checklist' and(jsonb_typeof(card_payload->'items') is distinct from 'array' or jsonb_array_length(card_payload->'items') not between 1 and 30) then raise exception 'Enter 1–30 checklist items';end if;
 if card_kind='checklist' and exists(select 1 from jsonb_array_elements(card_payload->'items') i where jsonb_typeof(i)<>'object' or length(coalesce(i->>'text','')) not between 1 and 200 or jsonb_typeof(i->'done') is distinct from 'boolean') then raise exception 'Invalid checklist item';end if;
 if card_kind='countdown' and(coalesce((card_payload->>'ends_at')::timestamptz,'-infinity')<=now()) then raise exception 'Choose a future countdown time';end if;
 if card_kind='note' and length(coalesce(card_payload->>'text',''))>10000 then raise exception 'Note too long';end if;
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,card_kind||': '||title,'text',null);
 insert into public.chat_living_messages(message_id,conversation_id,kind,payload,created_by) values(msg.id,target_conversation_id,card_kind,card_payload,auth.uid()) on conflict(message_id) do nothing;return msg.id;
end;$$;
create or replace function public.update_chat_living_message(target_message_id uuid,expected_version integer,item_index integer default null,note_text text default null) returns void language plpgsql security definer set search_path='' as $$
declare card public.chat_living_messages;
begin
 select l.* into card from public.chat_living_messages l join public.chat_messages m on m.id=l.message_id where l.message_id=target_message_id and public.is_conversation_member(l.conversation_id) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) for update of l;
 if not found or auth.uid() is null then raise exception 'Message unavailable';end if;
 if card.version<>expected_version then raise exception 'This card changed. Refresh and try again';end if;
 if card.kind='checklist' then
  if item_index is null or item_index<0 or item_index>=jsonb_array_length(card.payload->'items') then raise exception 'Invalid item';end if;
  update public.chat_living_messages set payload=jsonb_set(payload,array['items',item_index::text,'done'],to_jsonb(not (payload->'items'->item_index->>'done')::boolean)),version=version+1 where message_id=target_message_id;
 elsif card.kind='note' then
  if note_text is null or length(note_text)>10000 then raise exception 'Note too long';end if;
  update public.chat_living_messages set payload=jsonb_set(payload,'{text}',to_jsonb(note_text)),version=version+1 where message_id=target_message_id;
 else raise exception 'Countdown details cannot be changed';end if;
end;$$;
create table public.chat_tictactoe(message_id uuid primary key references public.chat_messages(id) on delete cascade,conversation_id uuid not null references public.conversations(id) on delete cascade,x_user uuid not null references auth.users(id) on delete cascade,o_user uuid not null references auth.users(id) on delete cascade,board integer[] not null default array[0,0,0,0,0,0,0,0,0],turn integer not null default 1,winner integer,version integer not null default 1);
alter table public.chat_tictactoe enable row level security;revoke all on public.chat_tictactoe from anon,authenticated;grant select on public.chat_tictactoe to authenticated;
create policy game_member_read on public.chat_tictactoe for select to authenticated using(public.is_conversation_member(conversation_id) and exists(select 1 from public.chat_messages m where m.id=message_id));
create or replace function public.start_chat_tictactoe(target_conversation_id uuid,operation_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare peer uuid;msg public.chat_messages;
begin
 if auth.uid() is null or not public.is_conversation_member(target_conversation_id) or not exists(select 1 from public.conversations where id=target_conversation_id and kind='direct') then raise exception 'Start a game in a direct chat';end if;
 select user_id into peer from public.conversation_members where conversation_id=target_conversation_id and user_id<>auth.uid();
 if peer is null then raise exception 'Other player unavailable';end if;
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,'Tic-tac-toe: your move!','text',null);
 insert into public.chat_tictactoe(message_id,conversation_id,x_user,o_user) values(msg.id,target_conversation_id,auth.uid(),peer) on conflict(message_id) do nothing;return msg.id;
end;$$;
create or replace function public.play_chat_tictactoe(target_message_id uuid,cell_index integer,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare g public.chat_tictactoe;player integer;line integer[];lines integer[][]:=array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]];i integer;
begin
 select t.* into g from public.chat_tictactoe t join public.chat_messages m on m.id=t.message_id where t.message_id=target_message_id and public.is_conversation_member(t.conversation_id) and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) for update of t;
 if not found or auth.uid() is null then raise exception 'Game unavailable';end if;
 player:=case when auth.uid()=g.x_user then 1 when auth.uid()=g.o_user then 2 else 0 end;
 if player=0 or g.winner is not null or player<>g.turn or expected_version<>g.version or cell_index is null or cell_index not between 0 and 8 or g.board[cell_index+1]<>0 then raise exception 'Wait for your turn or refresh this game';end if;
 g.board[cell_index+1]:=player;
 for i in 1..8 loop if g.board[lines[i][1]]=player and g.board[lines[i][2]]=player and g.board[lines[i][3]]=player then g.winner:=player;exit;end if;end loop;
 if g.winner is null and not(0=any(g.board)) then g.winner:=0;end if;
 update public.chat_tictactoe set board=g.board,turn=3-player,winner=g.winner,version=version+1 where message_id=target_message_id;
end;$$;
create or replace function public.create_chat_question(target_conversation_id uuid,poll_question text,option_texts text[],question_kind text,correct_index integer,operation_id text) returns uuid language plpgsql security definer set search_path='' as $$
declare msg public.chat_messages;pid uuid;
begin
 if question_kind not in ('poll','quiz','question') or (question_kind='quiz' and(correct_index is null or correct_index not between 1 and coalesce(cardinality(option_texts),0))) then raise exception 'Choose a correct quiz answer';end if;
 msg:=public.send_chat_message_idempotent(target_conversation_id,operation_id,question_kind||': '||poll_question,'text',null);
 perform 1 from public.chat_messages where id=msg.id for update;
 select id into pid from public.chat_polls where message_id=msg.id;
 if pid is null then perform public.create_chat_poll(msg.id,poll_question,option_texts,question_kind,false,false,null,case when question_kind='quiz' then array[correct_index] else '{}'::integer[] end);end if;return msg.id;
end;$$;
revoke all on function public.set_chat_group_rules(uuid,boolean,boolean,boolean),public.create_chat_living_message(uuid,text,jsonb,text),public.update_chat_living_message(uuid,integer,integer,text),public.start_chat_tictactoe(uuid,text),public.play_chat_tictactoe(uuid,integer,integer),public.create_chat_question(uuid,text,text[],text,integer,text) from public,anon;
grant execute on function public.set_chat_group_rules(uuid,boolean,boolean,boolean),public.create_chat_living_message(uuid,text,jsonb,text),public.update_chat_living_message(uuid,integer,integer,text),public.start_chat_tictactoe(uuid,text),public.play_chat_tictactoe(uuid,integer,integer),public.create_chat_question(uuid,text,text[],text,integer,text) to authenticated;
