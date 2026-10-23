-- Username-only signup: recovery codes and household-aware server-side quotas.
-- Additive, private, and safe for existing auth.users, profiles and chats.
begin;

create table if not exists luo_internal.auth_recovery_codes(
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  primary key(user_id,code_hash)
);
create index if not exists auth_recovery_codes_available_idx on luo_internal.auth_recovery_codes(user_id) where used_at is null;
alter table luo_internal.auth_recovery_codes enable row level security;
revoke all on luo_internal.auth_recovery_codes from public,anon,authenticated;
grant select,insert,update,delete on luo_internal.auth_recovery_codes to service_role;

-- Supabase Edge Functions use the service_role client. Clients cannot call
-- these operations even while signed in, and cannot view recovery digests.
create or replace function public.replace_luo_recovery_codes(target_user_id uuid,code_hashes text[])
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if target_user_id is null
   or coalesce(array_length(code_hashes,1),0)<>10
   or exists(select 1 from unnest(code_hashes) h where h !~ '^[0-9a-f]{64}$')
   or (select count(distinct h) from unnest(code_hashes) h)<>10
 then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('luo-recovery:'||target_user_id::text,0));
 delete from luo_internal.auth_recovery_codes where user_id=target_user_id;
 insert into luo_internal.auth_recovery_codes(user_id,code_hash)
 select target_user_id,h from unnest(code_hashes) h;
 return true;
end;$$;
revoke all on function public.replace_luo_recovery_codes(uuid,text[]) from public,anon,authenticated;
grant execute on function public.replace_luo_recovery_codes(uuid,text[]) to service_role;

create or replace function public.consume_luo_recovery_code(target_user_id uuid,code_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare consumed boolean:=false;
begin
 if target_user_id is null or code_hash !~ '^[0-9a-f]{64}$' then return false;end if;
 update luo_internal.auth_recovery_codes set used_at=now()
 where user_id=target_user_id and auth_recovery_codes.code_hash=consume_luo_recovery_code.code_hash and used_at is null;
 get diagnostics consumed = row_count;
 return consumed;
end;$$;
revoke all on function public.consume_luo_recovery_code(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_luo_recovery_code(uuid,text) to service_role;

create or replace function public.has_luo_recovery_codes()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from luo_internal.auth_recovery_codes c where c.user_id=auth.uid() and c.used_at is null);
$$;
revoke all on function public.has_luo_recovery_codes() from public,anon;
grant execute on function public.has_luo_recovery_codes() to authenticated;

-- Existing per-IP/hour quota remains an atomic advisory-locked database RPC;
-- add daily burst limits without imposing one-account-per-network.
create or replace function public.consume_signup_rate_limit(email_digest text,ip_digest text)
returns boolean language plpgsql security definer set search_path='' as $$
declare username_hour integer;ip_hour integer;ip_day integer;
begin
 if email_digest is null or email_digest !~ '^[a-f0-9]{64}$'
    or ip_digest is null or ip_digest !~ '^[a-f0-9]{64}$'
 then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('signup:user:'||email_digest,0));
 perform pg_advisory_xact_lock(hashtextextended('signup:ip:'||ip_digest,0));
 select count(*) into username_hour from public.auth_signup_attempts
 where email_hash=email_digest and attempted_at>now()-interval '1 hour';
 select count(*) into ip_hour from public.auth_signup_attempts
 where ip_hash=ip_digest and attempted_at>now()-interval '1 hour';
 select count(*) into ip_day from public.auth_signup_attempts
 where ip_hash=ip_digest and attempted_at>now()-interval '24 hours';
 if username_hour>=4 or ip_hour>=6 or ip_day>=12 then return false;end if;
 insert into public.auth_signup_attempts(email_hash,ip_hash) values(email_digest,ip_digest);
 return true;
end;$$;
revoke all on function public.consume_signup_rate_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_signup_rate_limit(text,text) to service_role;
commit;
