-- Development proposal, NOT applied to production. Requires the existing Luo social schema.
-- Generate a tracked migration with the Supabase CLI before an approved rollout.
-- Existing feed index covers (kind, created_at DESC, id DESC) WHERE published.
create index space_responses_reel_comments_cursor_idx on luo_internal.space_responses(entry_id,id) where kind='comment';
create table luo_internal.reel_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,target_id), check(follower_id<>target_id)
);
create index reel_follows_target_idx on luo_internal.reel_follows(target_id);
create table luo_internal.reel_choices (
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null references luo_internal.space_entries(id) on delete cascade,
 kind text not null check(kind in('repost','hidden','interested')),
 created_at timestamptz not null default now(), primary key(user_id,entry_id,kind)
);
create index reel_choices_entry_idx on luo_internal.reel_choices(entry_id,kind);
create table luo_internal.reel_comment_meta (
 response_id uuid primary key references luo_internal.space_responses(id) on delete cascade,
 parent_id uuid references luo_internal.space_responses(id) on delete cascade,
 removed boolean not null default false
);
create index reel_comment_parent_idx on luo_internal.reel_comment_meta(parent_id,response_id);
create table luo_internal.reel_comment_likes (
 response_id uuid not null references luo_internal.space_responses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(response_id,user_id)
);
create index reel_comment_likes_user_idx on luo_internal.reel_comment_likes(user_id);
create table luo_internal.reel_pins (
 entry_id uuid primary key references luo_internal.space_entries(id) on delete cascade,
 response_id uuid not null unique references luo_internal.space_responses(id) on delete cascade
);
alter table luo_internal.reel_follows enable row level security;
alter table luo_internal.reel_choices enable row level security;
alter table luo_internal.reel_comment_meta enable row level security;
alter table luo_internal.reel_comment_likes enable row level security;
alter table luo_internal.reel_pins enable row level security;
revoke all on luo_internal.reel_follows,luo_internal.reel_choices,luo_internal.reel_comment_meta,luo_internal.reel_comment_likes,luo_internal.reel_pins from public,anon,authenticated;

-- These private tables deliberately have no browser grants or direct RLS policies.
-- The explicitly authorized RPC is the only interface; it cannot choose an actor.
create function luo_internal.reel_comment_dto(r luo_internal.space_responses,actor uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'user_id',r.user_id,'body',case when coalesce(m.removed,false) then '[Comment removed]' else r.body end,
 'created_at',r.created_at,'username',p.username,'avatar_url',p.avatar_url,'parent_id',m.parent_id,'removed',coalesce(m.removed,false),
 'likes',(select count(*) from luo_internal.reel_comment_likes l where l.response_id=r.id and not luo_internal.space_blocked(actor,l.user_id)),
 'liked',exists(select 1 from luo_internal.reel_comment_likes l where l.response_id=r.id and l.user_id=actor),
 'replies',(select count(*) from luo_internal.reel_comment_meta child join luo_internal.space_responses cr on cr.id=child.response_id where child.parent_id=r.id and not child.removed and not luo_internal.space_blocked(actor,cr.user_id)),
 'pinned',exists(select 1 from luo_internal.reel_pins pin where pin.response_id=r.id))
 from public.profiles p left join luo_internal.reel_comment_meta m on m.response_id=r.id where p.id=r.user_id
$$;
revoke all on function luo_internal.reel_comment_dto(luo_internal.space_responses,uuid) from public,anon,authenticated;

create function public.luo_reels(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict error
declare actor uuid:=auth.uid(); e luo_internal.space_entries; r luo_internal.space_responses;
 parent luo_internal.space_responses; m public.chat_messages; target uuid; room uuid; op uuid;
 enabled boolean; used integer; rows jsonb; pinned jsonb; next_id uuid; v_mode text; v_kind text; body text;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>16000 then raise exception 'Invalid request' using errcode='22023';end if;
 if action not in('capabilities','state','feed','follow','repost','interest','comments','comment','comment.like','comment.remove','comment.pin','recipients','share') or action is null then raise exception 'Unknown action' using errcode='22023';end if;
 if action='capabilities' then return '{"version":1,"following":true,"reposts":true,"threads":true,"recipient_sharing":true}';end if;
 if action not in('state','feed','comments','recipients') then
  insert into luo_internal.space_limits(user_id,slot,uses) values(actor,date_trunc('minute',now()),1)
  on conflict(user_id,slot) do update set uses=space_limits.uses+1 where space_limits.uses<40 returning uses into used;
  if used is null then raise exception 'Please slow down and try again in a minute';end if;
 end if;
 if action='feed' then
  v_mode:=coalesce(input->>'mode','explore');
  if v_mode not in('following','saved','explore') then raise exception 'Invalid feed';end if;
  if (input->>'before' is null)<>(input->>'before_id' is null) then raise exception 'Incomplete cursor';end if;
  select coalesce(jsonb_agg(luo_internal.space_dto(x,actor) order by x.created_at desc,x.id desc),'[]') into rows from (
   select s.* from luo_internal.space_entries s where s.kind='clip' and s.published and luo_internal.space_visible(s,actor)
   and (input->>'before' is null or (s.created_at,s.id)<((input->>'before')::timestamptz,(input->>'before_id')::uuid))
   and (v_mode='saved' or not exists(select 1 from luo_internal.reel_choices c where c.user_id=actor and c.entry_id=s.id and c.kind='hidden'))
   and ((v_mode='explore' and s.audience='public') or (v_mode='following' and (exists(select 1 from luo_internal.reel_follows f where f.follower_id=actor and f.target_id=s.owner_id)
    or (s.audience='public' and exists(select 1 from luo_internal.reel_choices rep join luo_internal.reel_follows f on f.target_id=rep.user_id and f.follower_id=actor where rep.entry_id=s.id and rep.kind='repost' and not luo_internal.space_blocked(actor,rep.user_id)))))
    or (v_mode='saved' and exists(select 1 from luo_internal.space_responses sr where sr.entry_id=s.id and sr.user_id=actor and sr.kind='save')))
   order by s.created_at desc,s.id desc limit 20
  )x;return rows;
 end if;
 select * into e from luo_internal.space_entries s where s.id=(input->>'id')::uuid;
 if e.id is null or e.kind<>'clip' or not e.published or not coalesce(luo_internal.space_visible(e,actor),false) then raise exception 'Clip unavailable' using errcode='42501';end if;
 if action in('state','follow','repost','interest') then
  if action='follow' then
   if e.owner_id=actor then raise exception 'You cannot follow yourself';end if;
   enabled:=(input->>'enabled')::boolean;if enabled is null then raise exception 'Choose follow state';end if;
   perform pg_advisory_xact_lock(hashtextextended(actor::text,9812));
   if enabled then
    if not exists(select 1 from luo_internal.reel_follows where follower_id=actor and target_id=e.owner_id) and (select count(*) from luo_internal.reel_follows where follower_id=actor)>=5000 then raise exception 'Follow limit reached';end if;
    insert into luo_internal.reel_follows(follower_id,target_id) values(actor,e.owner_id) on conflict do nothing;
   else delete from luo_internal.reel_follows where follower_id=actor and target_id=e.owner_id;end if;
  elsif action in('repost','interest') then
   enabled:=(input->>'enabled')::boolean;if enabled is null then raise exception 'Choose an action state';end if;
   v_kind:=case when action='repost' then 'repost' when input->>'kind'='hidden' then 'hidden' when input->>'kind'='interested' then 'interested' else null end;
   if v_kind is null then raise exception 'Unknown preference';end if;
   if v_kind='repost' and e.audience<>'public' then raise exception 'Only public clips can be reposted';end if;
   if enabled then insert into luo_internal.reel_choices(user_id,entry_id,kind) values(actor,e.id,v_kind) on conflict do nothing;
   else delete from luo_internal.reel_choices where user_id=actor and entry_id=e.id and kind=v_kind;end if;
  end if;
  return jsonb_build_object('following',exists(select 1 from luo_internal.reel_follows where follower_id=actor and target_id=e.owner_id),
   'reposted',exists(select 1 from luo_internal.reel_choices where user_id=actor and entry_id=e.id and kind='repost'),
   'reposts',(select count(*) from luo_internal.reel_choices where entry_id=e.id and kind='repost' and not luo_internal.space_blocked(actor,user_id)),
   'hidden',exists(select 1 from luo_internal.reel_choices where user_id=actor and entry_id=e.id and kind='hidden'),
   'interested',exists(select 1 from luo_internal.reel_choices where user_id=actor and entry_id=e.id and kind='interested'),
   'comments',(select count(*) from luo_internal.space_responses s left join luo_internal.reel_comment_meta meta on meta.response_id=s.id where s.entry_id=e.id and s.kind='comment' and not coalesce(meta.removed,false) and not luo_internal.space_blocked(actor,s.user_id)));
 end if;
 if action='recipients' then
  if jsonb_typeof(input->'rooms') is distinct from 'array' or jsonb_array_length(input->'rooms')>100 then raise exception 'Choose at most 100 conversations';end if;
  select coalesce(jsonb_agg(x),'[]') into rows from (
   select c.id,p.username,p.display_name,p.avatar_url from public.conversations c
   join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=actor
   join public.conversation_members peer on peer.conversation_id=c.id and peer.user_id<>actor
   join public.profiles p on p.id=peer.user_id
   where c.kind='direct' and c.id in(select value::uuid from jsonb_array_elements_text(input->'rooms'))
   and public.can_write_luo_room(c.id) and luo_internal.space_visible(e,peer.user_id)
   and not luo_internal.space_blocked(actor,peer.user_id)
   and (select count(*) from public.conversation_members cm where cm.conversation_id=c.id)=2
   order by c.id limit 50
  )x;return rows;
 elsif action='share' then
  room:=(input->>'room')::uuid;op:=(input->>'operation')::uuid;
  if room is null or op is null or not coalesce(public.can_write_luo_room(room),false) then raise exception 'Conversation unavailable';end if;
  if not exists(select 1 from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id where c.id=room and c.kind='direct' and cm.user_id=actor)
   or (select count(*) from public.conversation_members cm where cm.conversation_id=room)<>2
   or exists(select 1 from public.conversation_members cm where cm.conversation_id=room and (not coalesce(luo_internal.space_visible(e,cm.user_id),false) or luo_internal.space_blocked(actor,cm.user_id))) then raise exception 'This recipient cannot view this clip';end if;
  m:=public.send_chat_message_idempotent(room,'luo-reel:'||op::text,'Luo Clip'||E'\n'||e.id::text,'text',null);
  return jsonb_build_object('message_id',m.id);
 end if;
 if input->>'parent_id' is not null then
  select * into parent from luo_internal.space_responses s where s.id=(input->>'parent_id')::uuid;
  if parent.id is null or parent.entry_id<>e.id or parent.kind<>'comment' or luo_internal.space_blocked(actor,parent.user_id)
   or exists(select 1 from luo_internal.reel_comment_meta meta where meta.response_id=parent.id and ((meta.removed and action='comment') or meta.parent_id is not null)) then raise exception 'Reply target unavailable';end if;
 end if;
 if action='comments' then
  if parent.id is null and input->>'after' is null then
   select luo_internal.reel_comment_dto(s,actor) into pinned from luo_internal.reel_pins pin join luo_internal.space_responses s on s.id=pin.response_id
   where pin.entry_id=e.id and not luo_internal.space_blocked(actor,s.user_id);
  end if;
  select coalesce(jsonb_agg(luo_internal.reel_comment_dto(x,actor) order by x.id),'[]') into rows from(
   select s.* from luo_internal.space_responses s left join luo_internal.reel_comment_meta meta on meta.response_id=s.id
   where s.entry_id=e.id and s.kind='comment' and meta.parent_id is not distinct from parent.id
   and not exists(select 1 from luo_internal.reel_pins pin where pin.response_id=s.id)
   and not luo_internal.space_blocked(actor,s.user_id) and (input->>'after' is null or s.id>(input->>'after')::uuid)
   order by s.id limit case when pinned is null then 50 else 49 end
  )x;if pinned is not null then rows:=jsonb_build_array(pinned)||rows;end if;return rows;
 elsif action='comment' then
  op:=(input->>'operation')::uuid;body:=trim(coalesce(input->>'body',''));
  if op is null or length(body) not between 1 and 300 then raise exception 'Comments use 1–300 characters';end if;
  perform pg_advisory_xact_lock(hashtextextended(op::text,9813));
  select * into r from luo_internal.space_responses s where s.id=op;
  if r.id is not null then
   if r.entry_id<>e.id or r.user_id<>actor or r.kind<>'comment' or r.body<>body or (select meta.parent_id from luo_internal.reel_comment_meta meta where meta.response_id=r.id) is distinct from parent.id then raise exception 'Operation conflict';end if;
  else
   perform public.luo_space('response',jsonb_build_object('id',e.id,'kind','comment','body',body,'operation',op));
   insert into luo_internal.reel_comment_meta(response_id,parent_id) values(op,parent.id);
   select * into r from luo_internal.space_responses s where s.id=op;
  end if;return luo_internal.reel_comment_dto(r,actor);
 end if;
 select * into r from luo_internal.space_responses s where s.id=(input->>'comment_id')::uuid for update;
 if r.id is null or r.entry_id<>e.id or r.kind<>'comment' or luo_internal.space_blocked(actor,r.user_id) then raise exception 'Comment unavailable';end if;
 if exists(select 1 from luo_internal.reel_comment_meta meta where meta.response_id=r.id and meta.removed) then raise exception 'Comment removed';end if;
 if action='comment.like' then
  enabled:=(input->>'enabled')::boolean;if enabled is null then raise exception 'Choose a like state';end if;
  if enabled then insert into luo_internal.reel_comment_likes(response_id,user_id) values(r.id,actor) on conflict do nothing;
  else delete from luo_internal.reel_comment_likes where response_id=r.id and user_id=actor;end if;
 elsif action='comment.remove' then
  if actor not in(r.user_id,e.owner_id) then raise exception 'Only the comment or clip author can remove it';end if;
  update luo_internal.space_responses set body='[Comment removed]' where id=r.id;
  insert into luo_internal.reel_comment_meta(response_id,removed) values(r.id,true) on conflict(response_id) do update set removed=true;
  delete from luo_internal.reel_comment_likes where response_id=r.id;delete from luo_internal.reel_pins where response_id=r.id;
  select * into r from luo_internal.space_responses s where s.id=r.id;
 elsif action='comment.pin' then
  if actor<>e.owner_id then raise exception 'Only the clip author can pin comments';end if;
  if exists(select 1 from luo_internal.reel_comment_meta meta where meta.response_id=r.id and meta.parent_id is not null) then raise exception 'Pin a top-level comment';end if;
  enabled:=(input->>'enabled')::boolean;if enabled is null then raise exception 'Choose a pin state';end if;
  if enabled then insert into luo_internal.reel_pins(entry_id,response_id) values(e.id,r.id) on conflict(entry_id) do update set response_id=excluded.response_id;
  else delete from luo_internal.reel_pins where entry_id=e.id and response_id=r.id;end if;
 end if;return luo_internal.reel_comment_dto(r,actor);
end;$$;
revoke all on function public.luo_reels(text,jsonb) from public,anon;
grant execute on function public.luo_reels(text,jsonb) to authenticated;
