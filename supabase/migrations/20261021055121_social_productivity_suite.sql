-- Owner-only personal documents. Imported archives never become live messages.
create table public.chat_private_documents(user_id uuid not null references auth.users(id) on delete cascade,document_id text not null check(length(document_id) between 1 and 100),kind text not null check(kind in ('folders','reading','occasion','archive','backup')),title text not null default '' check(length(title)<=160),payload jsonb not null check(octet_length(payload::text)<=2097152),updated_at timestamptz not null default now(),primary key(user_id,document_id));
alter table public.chat_private_documents enable row level security;
revoke all on public.chat_private_documents from public,anon,authenticated;
grant select,insert,update,delete on public.chat_private_documents to authenticated;
create policy private_documents_own on public.chat_private_documents for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index private_documents_kind_idx on public.chat_private_documents(user_id,kind,updated_at);
-- Shared drawings: membership is rechecked on every query and mutation.
create table public.chat_drawing_boards(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,created_by uuid not null references auth.users(id) on delete cascade,title text not null check(length(title) between 1 and 120),created_at timestamptz not null default now());
create table public.chat_drawing_strokes(id bigint generated always as identity primary key,board_id uuid not null references public.chat_drawing_boards(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,stroke jsonb not null check(octet_length(stroke::text)<=16000),created_at timestamptz not null default now(),unique(user_id,operation_id));
alter table public.chat_drawing_boards enable row level security;alter table public.chat_drawing_strokes enable row level security;
revoke all on public.chat_drawing_boards,public.chat_drawing_strokes from public,anon,authenticated;
grant select,insert on public.chat_drawing_boards to authenticated;grant select on public.chat_drawing_strokes to authenticated;
create policy drawing_board_member_read on public.chat_drawing_boards for select to authenticated using(public.is_conversation_member(conversation_id));
create policy drawing_board_member_create on public.chat_drawing_boards for insert to authenticated with check(created_by=(select auth.uid()) and public.is_conversation_member(conversation_id));
create policy drawing_stroke_member_read on public.chat_drawing_strokes for select to authenticated using(exists(select 1 from public.chat_drawing_boards b where b.id=board_id and public.is_conversation_member(b.conversation_id)));
create index drawing_board_room_idx on public.chat_drawing_boards(conversation_id,created_at);create index drawing_stroke_board_idx on public.chat_drawing_strokes(board_id,id);
create function public.append_chat_drawing(target_board uuid,operation uuid,drawing jsonb) returns void language plpgsql security definer set search_path='' as $$declare actor uuid:=auth.uid();begin
 if actor is null or not exists(select 1 from public.chat_drawing_boards where id=target_board and public.is_conversation_member(conversation_id)) then raise exception 'Board unavailable';end if;
 if exists(select 1 from public.chat_drawing_strokes where user_id=actor and operation_id=operation) then return;end if;
 if drawing is null or jsonb_typeof(drawing->'points') is distinct from 'array' or jsonb_array_length(drawing->'points') not between 1 and 256 or coalesce(drawing->>'color','')!~'^#[0-9a-fA-F]{6}$' or coalesce(drawing->>'width','')!~'^[1-9][0-9]?$' or octet_length(drawing::text)>16000 then raise exception 'Invalid stroke';end if;
 if exists(select 1 from jsonb_array_elements(drawing->'points') p where jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or (p->>0)::numeric not between 0 and 1 or (p->>1)::numeric not between 0 and 1) then raise exception 'Invalid points';end if;
 if (select count(*) from public.chat_drawing_strokes where user_id=actor and created_at>now()-interval '1 minute')>=120 or (select count(*) from public.chat_drawing_strokes where board_id=target_board)>=1000 then raise exception 'Drawing limit reached';end if;
 insert into public.chat_drawing_strokes(board_id,user_id,operation_id,stroke) values(target_board,actor,operation,drawing);
 end;$$;
-- Private call signaling: no direct writes or public realtime broadcasts.
create table public.chat_calls(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,caller_id uuid not null references auth.users(id) on delete cascade,callee_id uuid not null references auth.users(id) on delete cascade,kind text not null check(kind in ('audio','video')),status text not null default 'ringing' check(status in ('ringing','accepted','declined','ended','missed')),offer text check(length(offer)<=65536),answer text check(length(answer)<=65536),caller_ice jsonb not null default '[]',callee_ice jsonb not null default '[]',created_at timestamptz not null default now(),ended_at timestamptz,check(caller_id<>callee_id));
alter table public.chat_calls enable row level security;revoke all on public.chat_calls from public,anon,authenticated;grant select on public.chat_calls to authenticated;
create policy calls_participant_read on public.chat_calls for select to authenticated using((caller_id=(select auth.uid()) or callee_id=(select auth.uid())) and public.is_conversation_member(conversation_id));
create index calls_callee_recent_idx on public.chat_calls(callee_id,created_at desc);create index calls_caller_recent_idx on public.chat_calls(caller_id,created_at desc);create index calls_room_idx on public.chat_calls(conversation_id,created_at desc);
create function public.start_luo_call(target_room uuid,call_kind text,offer_sdp text) returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=auth.uid();peer uuid;new_id uuid;begin
 if actor is null or call_kind not in('audio','video') or offer_sdp is null or length(offer_sdp) not between 1 and 65536 or not public.is_conversation_member(target_room) or not exists(select 1 from public.conversations where id=target_room and kind='direct') or (select count(*) from public.conversation_members where conversation_id=target_room)<>2 then raise exception 'Choose an available direct conversation';end if;
 select user_id into peer from public.conversation_members where conversation_id=target_room and user_id<>actor;
 if exists(select 1 from public.chat_user_blocks where (blocker_id=actor and blocked_id=peer) or(blocker_id=peer and blocked_id=actor)) then raise exception 'Call unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor,peer)::text,0));perform pg_advisory_xact_lock(hashtextextended(greatest(actor,peer)::text,0));
 update public.chat_calls set status=case when status='ringing' then 'missed' else 'ended' end,ended_at=now(),offer=null,answer=null,caller_ice='[]',callee_ice='[]' where status in('ringing','accepted') and created_at<now()-interval '2 hours';
 if (select count(*) from public.chat_calls where caller_id=actor and created_at>now()-interval '1 minute')>=3 or exists(select 1 from public.chat_calls where status in('ringing','accepted') and (caller_id in(actor,peer) or callee_id in(actor,peer)) and (status='accepted' or created_at>now()-interval '60 seconds')) then raise exception 'A call is already active or the call limit was reached';end if;
 insert into public.chat_calls(conversation_id,caller_id,callee_id,kind,offer) values(target_room,actor,peer,call_kind,offer_sdp) returning id into new_id;return new_id;end;$$;
create function public.signal_luo_call(target_call uuid,signal_kind text,signal_data text default null) returns void language plpgsql security definer set search_path='' as $$declare actor uuid:=auth.uid();c public.chat_calls;candidate jsonb;begin
 select * into c from public.chat_calls where id=target_call for update;
 if actor is null or c.id is null or actor not in(c.caller_id,c.callee_id) or not public.is_conversation_member(c.conversation_id) then raise exception 'Call unavailable';end if;
 if signal_kind='end' then update public.chat_calls set status=case when status='ringing' and actor=callee_id then 'declined' else 'ended' end,ended_at=now(),offer=null,answer=null,caller_ice='[]',callee_ice='[]' where id=c.id and status in('ringing','accepted');return;end if;
 if c.status not in('ringing','accepted') or c.created_at<now()-interval '2 hours' or (c.status='ringing' and c.created_at<now()-interval '60 seconds') then raise exception 'Call expired';end if;
 if exists(select 1 from public.chat_user_blocks where (blocker_id=c.caller_id and blocked_id=c.callee_id) or(blocker_id=c.callee_id and blocked_id=c.caller_id)) then raise exception 'Call unavailable';end if;
 if signal_kind='answer' and actor=c.callee_id and c.status='ringing' and length(signal_data) between 1 and 65536 then update public.chat_calls set answer=signal_data,status='accepted' where id=c.id;
 elsif signal_kind='ice' then
  if signal_data is null or length(signal_data)>3000 then raise exception 'Invalid ICE candidate';end if;candidate=signal_data::jsonb;
  if jsonb_typeof(candidate)<>'object' or jsonb_typeof(candidate->'candidate')<>'string' then raise exception 'Invalid ICE candidate';end if;
  if actor=c.caller_id and jsonb_array_length(c.caller_ice)<100 then update public.chat_calls set caller_ice=caller_ice||jsonb_build_array(candidate) where id=c.id;
  elsif actor=c.callee_id and jsonb_array_length(c.callee_ice)<100 then update public.chat_calls set callee_ice=callee_ice||jsonb_build_array(candidate) where id=c.id;else raise exception 'ICE limit reached';end if;
 else raise exception 'Invalid call action';end if;end;$$;
revoke all on function public.append_chat_drawing(uuid,uuid,jsonb),public.start_luo_call(uuid,text,text),public.signal_luo_call(uuid,text,text) from public,anon;
grant execute on function public.append_chat_drawing(uuid,uuid,jsonb),public.start_luo_call(uuid,text,text),public.signal_luo_call(uuid,text,text) to authenticated;

create schema if not exists luo_internal;revoke all on schema luo_internal from public,anon,authenticated;
create function luo_internal.bound_private_documents() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,17));
 if (select count(*) from public.chat_private_documents where user_id=new.user_id and document_id<>new.document_id)>=200 or (select coalesce(sum(octet_length(payload::text)),0) from public.chat_private_documents where user_id=new.user_id and document_id<>new.document_id)+octet_length(new.payload::text)>52428800 then raise exception 'Private archive storage limit reached';end if;new.updated_at=now();return new;end;$$;
revoke all on function luo_internal.bound_private_documents() from public,anon,authenticated;
create trigger bound_private_documents before insert or update on public.chat_private_documents for each row execute function luo_internal.bound_private_documents();
-- Album items retain the existing validated attachment path and permissions.
alter table public.chat_messages add column album_id uuid,add column album_index integer,add column album_total integer,add constraint chat_album_shape check((album_id is null and album_index is null and album_total is null) or(album_id is not null and album_index between 0 and 19 and album_total between 2 and 20 and album_index<album_total));
create index chat_album_idx on public.chat_messages(conversation_id,album_id) where album_id is not null;
create table public.chat_albums(id uuid primary key,conversation_id uuid not null references public.conversations(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,item_total integer not null check(item_total between 2 and 20),created_at timestamptz not null default now());
alter table public.chat_albums enable row level security;revoke all on public.chat_albums from public,anon,authenticated;grant select on public.chat_albums to authenticated;
create policy albums_member_read on public.chat_albums for select to authenticated using(public.is_conversation_member(conversation_id));create index albums_room_idx on public.chat_albums(conversation_id,created_at);
create function public.send_luo_album_item(target_conversation_id uuid,operation_id text,message_body text,uploaded_path text,uploaded_name text,uploaded_type text,uploaded_bytes bigint,uploaded_checksum text,album uuid,item_index integer,item_total integer) returns public.chat_messages language plpgsql security definer set search_path='' as $$declare m public.chat_messages;begin
 if auth.uid() is null or album is null or item_index is null or item_total is null or item_total not between 2 and 20 or item_index<0 or item_index>=item_total or uploaded_type not in('image/jpeg','image/png','image/webp','image/gif') then raise exception 'Invalid album item';end if;
 if not public.is_conversation_member(target_conversation_id) then raise exception 'Album unavailable';end if;
 insert into public.chat_albums(id,conversation_id,owner_id,item_total) values(album,target_conversation_id,auth.uid(),item_total) on conflict do nothing;
 perform 1 from public.chat_albums where id=album for update;
 if not exists(select 1 from public.chat_albums a where a.id=album and a.owner_id=auth.uid() and a.conversation_id=target_conversation_id and a.item_total=send_luo_album_item.item_total) then raise exception 'Album unavailable';end if;
 m=public.send_chat_attachment(target_conversation_id,operation_id,message_body,null,uploaded_path,uploaded_name,uploaded_type,uploaded_bytes,uploaded_checksum);
 if m.album_id is not null and(m.album_id<>album or m.album_index<>item_index or m.album_total<>item_total) then raise exception 'Upload belongs to another album';end if;
 update public.chat_messages set album_id=album,album_index=item_index,album_total=item_total where id=m.id returning * into m;return m;end;$$;
revoke all on function public.send_luo_album_item(uuid,text,text,text,text,text,bigint,text,uuid,integer,integer) from public,anon;grant execute on function public.send_luo_album_item(uuid,text,text,text,text,text,bigint,text,uuid,integer,integer) to authenticated;
-- Push subscriptions and delivery queue. No subscription endpoints are exposed to peers.
create table public.chat_push_subscriptions(user_id uuid not null references auth.users(id) on delete cascade,endpoint text not null check(length(endpoint)<=2048 and endpoint~'^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]#]+$'),p256dh text not null check(p256dh~'^[A-Za-z0-9_-]{80,90}={0,2}$'),auth_key text not null check(auth_key~'^[A-Za-z0-9_-]{20,30}={0,2}$'),created_at timestamptz not null default now(),primary key(user_id,endpoint));
alter table public.chat_push_subscriptions enable row level security;revoke all on public.chat_push_subscriptions from public,anon,authenticated;grant select,insert,update,delete on public.chat_push_subscriptions to authenticated;
create policy push_subscription_own on public.chat_push_subscriptions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create table luo_internal.push_config(singleton boolean primary key default true check(singleton),public_key text not null,private_key text not null,worker_key text not null);
create table luo_internal.push_queue(id bigint generated always as identity primary key,message_id uuid not null references public.chat_messages(id) on delete cascade,user_id uuid not null,endpoint text not null,attempts integer not null default 0,available_at timestamptz not null default now(),lease_until timestamptz,created_at timestamptz not null default now(),foreign key(user_id,endpoint) references public.chat_push_subscriptions(user_id,endpoint) on delete cascade,unique(message_id,user_id,endpoint));
alter table luo_internal.push_config enable row level security;alter table luo_internal.push_queue enable row level security;revoke all on all tables in schema luo_internal from public,anon,authenticated;
create index push_queue_due_idx on luo_internal.push_queue(available_at,lease_until);
create function public.get_luo_push_public_key() returns text language sql stable security definer set search_path='' as $$select public_key from luo_internal.push_config where singleton;$$;
create function public.luo_push_worker_config() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('publicKey',public_key,'privateKey',private_key,'workerKey',worker_key) from luo_internal.push_config where singleton;$$;
create function luo_internal.push_allowed(target_user uuid,target_room uuid) returns boolean language plpgsql stable security definer set search_path='' as $$declare p public.user_notification_preferences;t time;kind text;pref public.user_conversation_settings;begin
 if not exists(select 1 from public.conversation_members where conversation_id=target_room and user_id=target_user and not muted) then return false;end if;
 select * into pref from public.user_conversation_settings where user_id=target_user and conversation_id=target_room;
 if pref.folder='hidden' or pref.muted or pref.notification_level='none' or pref.muted_until>now() then return false;end if;
 select * into p from public.user_notification_preferences where user_id=target_user;select c.kind into kind from public.conversations c where c.id=target_room;
 if p.user_id is not null then
 if not p.system_notifications or(kind='direct' and not p.direct_messages)or(kind='group' and not p.group_messages) then return false;end if;
 if p.quiet_hours_enabled then t=timezone(p.time_zone,now())::time;if (p.quiet_hours_start<p.quiet_hours_end and t>=p.quiet_hours_start and t<p.quiet_hours_end)or(p.quiet_hours_start>=p.quiet_hours_end and(t>=p.quiet_hours_start or t<p.quiet_hours_end)) then return false;end if;end if;end if;return true;
 exception when others then return false;end;$$;
create function luo_internal.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into luo_internal.push_queue(message_id,user_id,endpoint)
 select new.id,s.user_id,s.endpoint from public.chat_push_subscriptions s join public.conversation_members cm on cm.user_id=s.user_id and cm.conversation_id=new.conversation_id where s.user_id<>new.sender_id and luo_internal.push_allowed(s.user_id,new.conversation_id) and not exists(select 1 from public.chat_user_blocks where (blocker_id=s.user_id and blocked_id=new.sender_id)or(blocker_id=new.sender_id and blocked_id=s.user_id)) on conflict do nothing;return new;
 exception when others then raise warning 'LUO_PUSH_QUEUE_UNAVAILABLE';return new;end;$$;
create trigger enqueue_luo_web_push after insert on public.chat_messages for each row execute function luo_internal.enqueue_push();
create function public.claim_luo_push_work() returns table(id bigint,user_id uuid,endpoint text,p256dh text,auth_key text) language sql security definer set search_path='' as $$
 with chosen as(select q.id from luo_internal.push_queue q join public.chat_messages m on m.id=q.message_id where q.available_at<=now() and(q.lease_until is null or q.lease_until<now()) and q.attempts<5 and q.created_at>now()-interval '1 day' and m.deleted_at is null and m.recalled_at is null and(m.expires_at is null or m.expires_at>now()) and luo_internal.push_allowed(q.user_id,m.conversation_id) and not exists(select 1 from public.chat_user_blocks where(blocker_id=q.user_id and blocked_id=m.sender_id)or(blocker_id=m.sender_id and blocked_id=q.user_id)) order by q.id for update of q skip locked limit 25),leased as(update luo_internal.push_queue q set attempts=q.attempts+1,lease_until=now()+interval '2 minutes',available_at=now()+interval '5 minutes' from chosen where q.id=chosen.id returning q.id,q.user_id,q.endpoint)select l.id,l.user_id,l.endpoint,s.p256dh,s.auth_key from leased l join public.chat_push_subscriptions s on s.user_id=l.user_id and s.endpoint=l.endpoint;$$;
create function public.finish_luo_push_work(work_id bigint,delivered boolean,expired boolean default false) returns void language plpgsql security definer set search_path='' as $$declare q luo_internal.push_queue;begin
 select * into q from luo_internal.push_queue where id=work_id;if q.id is null then return;end if;
 if expired then delete from public.chat_push_subscriptions where user_id=q.user_id and endpoint=q.endpoint;elsif delivered then delete from luo_internal.push_queue where id=work_id;else update luo_internal.push_queue set lease_until=null where id=work_id;end if;end;$$;
create function luo_internal.run_push_worker() returns void language plpgsql security definer set search_path='' as $$declare token text;begin
 update public.chat_calls set status=case when status='ringing' then 'missed' else 'ended' end,ended_at=now(),offer=null,answer=null,caller_ice='[]',callee_ice='[]' where(status='ringing' and created_at<now()-interval '60 seconds')or(status='accepted' and created_at<now()-interval '2 hours');
 delete from luo_internal.push_queue where created_at<now()-interval '1 day' or attempts>=5;
 if not exists(select 1 from luo_internal.push_queue where available_at<=now() and(lease_until is null or lease_until<now()))then return;end if;
 select worker_key into token from luo_internal.push_config where singleton;if token is null then return;end if;
 perform net.http_post(url:='https://byjixqwpjvsgmqilmzbm.supabase.co/functions/v1/luo-web-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}',timeout_milliseconds:=10000);end;$$;
revoke all on function public.get_luo_push_public_key(),public.luo_push_worker_config(),public.claim_luo_push_work(),public.finish_luo_push_work(bigint,boolean,boolean),luo_internal.push_allowed(uuid,uuid),luo_internal.enqueue_push(),luo_internal.run_push_worker() from public,anon,authenticated;
grant execute on function public.get_luo_push_public_key() to authenticated;
grant execute on function public.luo_push_worker_config(),public.claim_luo_push_work(),public.finish_luo_push_work(bigint,boolean,boolean) to service_role;
select cron.schedule('luo-web-push-delivery','* * * * *','select luo_internal.run_push_worker()');

create unique index push_endpoint_unique_idx on public.chat_push_subscriptions(endpoint);
create function luo_internal.bound_push_subscriptions() returns trigger language plpgsql security definer set search_path='' as $$begin perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,31));if(select count(*) from public.chat_push_subscriptions where user_id=new.user_id and endpoint<>new.endpoint)>=10 then raise exception 'Maximum ten push devices';end if;return new;end;$$;
revoke all on function luo_internal.bound_push_subscriptions() from public,anon,authenticated;
create trigger bound_push_devices before insert or update on public.chat_push_subscriptions for each row execute function luo_internal.bound_push_subscriptions();
