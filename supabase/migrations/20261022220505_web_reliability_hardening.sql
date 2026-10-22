-- Additive indexes support stable keyset pagination, bounded rate checks and cleanup.
set lock_timeout='3s';
set statement_timeout='30s';
create index if not exists chat_messages_visible_cursor_idx on public.chat_messages(conversation_id,created_at desc,id desc) where deleted_at is null and recalled_at is null;
create index if not exists chat_messages_sender_recent_idx on public.chat_messages(sender_id,created_at desc);
create index if not exists storage_cleanup_due_idx on public.storage_cleanup_queue(queued_at,id) where attempts<10;

-- Lock each quota dimension separately. Locking the (email,IP) pair allowed
-- different pairs sharing an email or IP to pass their count simultaneously.
create or replace function public.consume_signup_rate_limit(email_digest text,ip_digest text) returns boolean language plpgsql security definer set search_path='' as $$
declare email_count integer;ip_count integer;
begin
 if email_digest is null or email_digest !~ '^[a-f0-9]{64}$' or ip_digest is null or ip_digest !~ '^[a-f0-9]{64}$' then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('signup:email:'||email_digest,0));
 perform pg_advisory_xact_lock(hashtextextended('signup:ip:'||ip_digest,0));
 select count(*) into email_count from public.auth_signup_attempts where email_hash=email_digest and attempted_at>now()-interval '1 hour';
 select count(*) into ip_count from public.auth_signup_attempts where ip_hash=ip_digest and attempted_at>now()-interval '1 hour';
 if email_count>=5 or ip_count>=20 then return false;end if;
 insert into public.auth_signup_attempts(email_hash,ip_hash) values(email_digest,ip_digest);
 delete from public.auth_signup_attempts where attempted_at<now()-interval '30 days';return true;
end;$$;
create or replace function public.consume_auth_action_limit(action_name text,email_digest text,ip_digest text,max_email integer default 5,max_ip integer default 20,window_minutes integer default 60) returns boolean language plpgsql security definer set search_path='' as $$
declare email_count integer;ip_count integer;
begin
 if $1 is null or $1 not in('password_reset','resend_confirmation','signin') or $2 is null or $2 !~ '^[a-f0-9]{64}$' or $3 is null or $3 !~ '^[a-f0-9]{64}$' or $4 is null or $4 not between 1 and 100 or $5 is null or $5 not between 1 and 1000 or $6 is null or $6 not between 1 and 1440 then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('action:email:'||$1||':'||$2,0));
 perform pg_advisory_xact_lock(hashtextextended('action:ip:'||$1||':'||$3,0));
 select count(*) into email_count from public.auth_action_attempts a where a.action_name=$1 and a.email_hash=$2 and a.attempted_at>now()-make_interval(mins=>$6);
 select count(*) into ip_count from public.auth_action_attempts a where a.action_name=$1 and a.ip_hash=$3 and a.attempted_at>now()-make_interval(mins=>$6);
 if email_count>=$4 or ip_count>=$5 then return false;end if;
 insert into public.auth_action_attempts(action_name,email_hash,ip_hash) values($1,$2,$3);
 delete from public.auth_action_attempts where attempted_at<now()-interval '30 days';return true;
end;$$;
revoke all on function public.consume_signup_rate_limit(text,text) from public,anon,authenticated;
revoke all on function public.consume_auth_action_limit(text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_signup_rate_limit(text,text),public.consume_auth_action_limit(text,text,text,integer,integer,integer) to service_role;

-- Database enforcement covers all authenticated message-writing RPCs. Replays
-- of an existing operation do not consume quota; server scheduled work is separate.
create or replace function luo_internal.limit_chat_message_rate() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 -- Trusted automatic replies may run under the original sender's JWT.
 -- Existing RPC/grant/ownership guards remain responsible for sender authorization.
 if actor is null or actor is distinct from new.sender_id then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('message-rate:'||actor::text,0));
 if new.client_operation_id is not null and exists(select 1 from public.chat_messages where sender_id=actor and client_operation_id=new.client_operation_id) then return new;end if;
 if(select count(*) from public.chat_messages where sender_id=actor and created_at>now()-interval '1 minute')>=120 then raise exception 'Message limit reached. Wait a minute and retry.' using errcode='P0001';end if;
 return new;
end;$$;
revoke all on function luo_internal.limit_chat_message_rate() from public,anon,authenticated;
create trigger limit_chat_message_rate before insert on public.chat_messages for each row execute function luo_internal.limit_chat_message_rate();
