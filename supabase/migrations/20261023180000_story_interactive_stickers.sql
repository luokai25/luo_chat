-- Interactive Story polls / quizzes. No direct client table access.
-- A story remains private; viewers cannot read another person's vote.
begin;
create table public.chat_story_prompts(
 story_id uuid primary key references public.chat_stories(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 prompt_type text not null check(prompt_type in ('poll','quiz')),
 question text not null check(length(btrim(question)) between 3 and 160),
 choices text[] not null check(cardinality(choices) between 2 and 4),
 correct_index integer,
 created_at timestamptz not null default now(),
 check((prompt_type='poll' and correct_index is null)
    or (prompt_type='quiz' and correct_index between 0 and cardinality(choices)-1))
);
create index chat_story_prompts_owner_time_idx
 on public.chat_story_prompts(owner_id,created_at desc);
create table public.chat_story_votes(
 story_id uuid not null references public.chat_story_prompts(story_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 choice_index integer not null check(choice_index between 0 and 3),
 created_at timestamptz not null default now(),
 primary key(story_id,user_id)
);
create index chat_story_votes_user_time_idx
 on public.chat_story_votes(user_id,created_at desc);
alter table public.chat_story_prompts enable row level security;
alter table public.chat_story_votes enable row level security;
revoke all on public.chat_story_prompts,public.chat_story_votes from public,anon,authenticated;

create or replace function public.create_chat_story_prompt(
 target_story_id uuid,prompt_kind text,prompt_question text,
 prompt_choices text[],answer_index integer default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();story_owner uuid;num integer;
begin
 if actor is null or target_story_id is null then return false;end if;
 select s.owner_id into story_owner from public.chat_stories s
  where s.id=target_story_id and s.expires_at>now();
 if story_owner is distinct from actor then return false;end if;
 num:=coalesce(cardinality(prompt_choices),0);
 if prompt_kind not in ('poll','quiz') or prompt_question is null
  or length(btrim(prompt_question)) not between 3 and 160
  or num not between 2 and 4
  or exists(select 1 from unnest(prompt_choices) c
    where c is null or length(btrim(c)) not between 1 and 80)
  or (select count(distinct lower(btrim(c))) from unnest(prompt_choices) c)<>num
  or (prompt_kind='poll' and answer_index is not null)
  or (prompt_kind='quiz' and
    (answer_index is null or answer_index<0 or answer_index>=num))
 then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('story-prompt:'||actor::text,0));
 if not exists(select 1 from public.chat_story_prompts where story_id=target_story_id)
  and (select count(*) from public.chat_story_prompts
       where owner_id=actor and created_at>now()-interval '24 hours')>=24
 then return false;end if;
 insert into public.chat_story_prompts(
  story_id,owner_id,prompt_type,question,choices,correct_index)
 values(target_story_id,actor,prompt_kind,btrim(prompt_question),
  array(select btrim(c) from unnest(prompt_choices) c),answer_index)
 on conflict(story_id) do nothing;
 return exists(select 1 from public.chat_story_prompts p
  where p.story_id=target_story_id and p.owner_id=actor
    and p.prompt_type=prompt_kind and p.question=btrim(prompt_question)
    and p.choices=array(select btrim(c) from unnest(prompt_choices) c)
    and p.correct_index is not distinct from answer_index);
end;$$;

create or replace function public.get_chat_story_prompt(target_story_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();prompt public.chat_story_prompts%rowtype;
 story_owner uuid;mine integer;totals jsonb;total_count bigint;
begin
 if actor is null or target_story_id is null or
  not public.can_view_chat_story(target_story_id) then return null;end if;
 select p.* into prompt from public.chat_story_prompts p
  where p.story_id=target_story_id;
 if not found then return null;end if;
 select s.owner_id into story_owner from public.chat_stories s
  where s.id=target_story_id;
 select v.choice_index into mine from public.chat_story_votes v
  where v.story_id=target_story_id and v.user_id=actor;
 -- Before voting, neither totals nor the quiz correct index are disclosed
 -- to other viewers. Authors may view totals for their own story.
 if actor=story_owner or mine is not null then
  select jsonb_agg(coalesce((
   select count(*) from public.chat_story_votes v
   where v.story_id=target_story_id and v.choice_index=idx
  ),0) order by idx) into totals
   from generate_series(0,cardinality(prompt.choices)-1) idx;
  select count(*) into total_count from public.chat_story_votes
   where story_id=target_story_id;
 else
  totals:=null;total_count:=null;
 end if;
 return jsonb_build_object(
  'story_id',target_story_id,'kind',prompt.prompt_type,
  'question',prompt.question,'choices',to_jsonb(prompt.choices),
  'my_choice',mine,
  'total_votes',total_count,'counts',totals,
  'correct_index',case when actor=story_owner or mine is not null
   then prompt.correct_index else null end,
  'is_owner',actor=story_owner);
end;$$;

create or replace function public.vote_chat_story_prompt(
 target_story_id uuid,selected_index integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();story_owner uuid;count_choices integer;
begin
 if actor is null or target_story_id is null
  or not public.can_view_chat_story(target_story_id) then return null;end if;
 select s.owner_id,cardinality(p.choices)
 into story_owner,count_choices
 from public.chat_stories s join public.chat_story_prompts p
  on p.story_id=s.id where s.id=target_story_id and s.expires_at>now();
 if story_owner is null or story_owner=actor or selected_index is null
   or selected_index<0 or selected_index>=count_choices then return null;end if;
 -- Each participant has one immutable answer. Retried requests do not
 -- create extra votes and may not change a previously selected option.
 if not exists(select 1 from public.chat_story_votes
  where user_id=actor and created_at>now()-interval '1 minute'
  group by user_id having count(*)>=15)
 then
  insert into public.chat_story_votes(story_id,user_id,choice_index)
   values(target_story_id,actor,selected_index)
   on conflict(story_id,user_id) do nothing;
 end if;
 return public.get_chat_story_prompt(target_story_id);
end;$$;

revoke all on function public.create_chat_story_prompt(uuid,text,text,text[],integer),
 public.get_chat_story_prompt(uuid),public.vote_chat_story_prompt(uuid,integer)
 from public,anon;
grant execute on function public.create_chat_story_prompt(uuid,text,text,text[],integer),
 public.get_chat_story_prompt(uuid),public.vote_chat_story_prompt(uuid,integer)
 to authenticated;
commit;
