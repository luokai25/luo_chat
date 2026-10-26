begin;
create schema if not exists luo_agent_verify;
revoke all on schema luo_agent_verify from public,anon,authenticated;
grant usage on schema luo_agent_verify to service_role;
create table if not exists luo_agent_verify.requests (
 id uuid primary key default gen_random_uuid(),
 username text not null check(username ~ '^[a-z][a-z0-9_]{2,23}$'),
 public_key text not null check(public_key ~ '^[A-Za-z0-9_-]{43}$'),
 key_fingerprint text not null check(key_fingerprint ~ '^[a-f0-9]{64}$'),
 challenge_nonce text not null check(challenge_nonce ~ '^[A-Za-z0-9_-]{43}$'),
 state text not null default 'pending' check(state in ('pending','verified')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '10 minutes'),
 verified_at timestamptz,
 verified_until timestamptz,
 signature_digest text check(signature_digest is null or signature_digest ~ '^[a-f0-9]{64}$'),
 constraint verification_must_be_complete check(
 (state='pending' and verified_at is null and verified_until is null and signature_digest is null) or
 (state='verified' and verified_at is not null and verified_until is not null and signature_digest is not null))
);
create index if not exists luo_agent_verify_pending_expiry on luo_agent_verify.requests(expires_at) where state='pending';
create index if not exists luo_agent_verify_verified_expiry on luo_agent_verify.requests(verified_until) where state='verified';
create table if not exists luo_agent_verify.limits(
 day date not null,
 scope text not null check(scope in ('global','network','key','name')),
 digest text not null check(length(digest) between 3 and 64),
 attempts integer not null check(attempts between 0 and 2500),
 primary key(day,scope,digest)
);
alter table luo_agent_verify.requests enable row level security;
alter table luo_agent_verify.limits enable row level security;
revoke all on luo_agent_verify.requests from public,anon,authenticated;
revoke all on luo_agent_verify.limits from public,anon,authenticated;
grant select,insert,update on luo_agent_verify.requests to service_role;
grant select,insert,update on luo_agent_verify.limits to service_role;
CREATE OR REPLACE FUNCTION public.luo_agent_verify_complete(p_id uuid, p_signature_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_until timestamptz;
begin
 if p_signature_digest is null or p_signature_digest !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid proof digest' using errcode='22023';end if;
 update luo_agent_verify.requests set state='verified',verified_at=now(),
  verified_until=now()+interval '30 days',signature_digest=p_signature_digest
 where id=p_id and state='pending' and expires_at>now()
 returning verified_until into v_until;
 if v_until is null then return null;end if;
 return jsonb_build_object('id',p_id,'state','key_verified','verified_until',v_until);
end;$function$
;

CREATE OR REPLACE FUNCTION public.luo_agent_verify_read(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',id,'username',username,'public_key',public_key,
 'challenge_nonce',challenge_nonce,'state',state,'expires_at',expires_at)
 from luo_agent_verify.requests where id=p_id
$function$
;

CREATE OR REPLACE FUNCTION public.luo_agent_verify_start(p_username text, p_public_key text, p_fingerprint text, p_nonce text, p_network_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_scope text;v_digest text;v_cap integer;v_count integer;v_id uuid;v_expires timestamptz;
begin
 if p_username is null or p_username !~ '^[a-z][a-z0-9_]{2,23}$'
 or p_public_key is null or p_public_key !~ '^[a-zA-Z0-9_-]{43}$'
 or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
 or p_nonce is null or p_nonce !~ '^[a-zA-Z0-9_-]{43}$'
 or p_network_digest is null or p_network_digest !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid verification request' using errcode='22023';end if;
 for v_scope,v_digest,v_cap in
  select * from (values
    ('global','all',2000),
    ('network',p_network_digest,12),
    ('key',p_fingerprint,8),
    ('name',p_username,8)
  ) v(scope,digest,cap)
 loop
   v_count:=null;
   insert into luo_agent_verify.limits(day,scope,digest,attempts)
   values((now() at time zone 'utc')::date,v_scope,v_digest,1)
   on conflict(day,scope,digest) do update set attempts=luo_agent_verify.limits.attempts+1
   where luo_agent_verify.limits.attempts<v_cap
   returning attempts into v_count;
   if v_count is null then raise exception 'Verification rate limited' using errcode='P0001';end if;
 end loop;
 insert into luo_agent_verify.requests(username,public_key,key_fingerprint,challenge_nonce)
 values(p_username,p_public_key,p_fingerprint,p_nonce) returning id,expires_at into v_id,v_expires;
 return jsonb_build_object('id',v_id,'expires_at',v_expires);
end;$function$
;

CREATE OR REPLACE FUNCTION public.luo_agent_verify_status(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',id,
  'state',case when state='verified' and verified_until>now() then 'key_verified'
   when state='pending' and expires_at>now() then 'challenge_pending'
   else 'expired' end,
  'membership_active',false,'chat_access',false,
  'expires_at',case when state='verified' then verified_until else expires_at end)
 from luo_agent_verify.requests where id=p_id
$function$
;

revoke all on function public.luo_agent_verify_start(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.luo_agent_verify_read(uuid) from public,anon,authenticated;
revoke all on function public.luo_agent_verify_complete(uuid,text) from public,anon,authenticated;
revoke all on function public.luo_agent_verify_status(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_verify_start(text,text,text,text,text) to service_role;
grant execute on function public.luo_agent_verify_read(uuid) to service_role;
grant execute on function public.luo_agent_verify_complete(uuid,text) to service_role;
grant execute on function public.luo_agent_verify_status(uuid) to service_role;
commit;
