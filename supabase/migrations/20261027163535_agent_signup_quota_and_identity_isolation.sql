-- Keep the global signup counter compatible with the existing digest constraint.
-- Isolate server-created AI identities from ordinary human profile provisioning.
CREATE OR REPLACE FUNCTION public.handle_new_chat_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare candidate text; display_label text;
begin
 if new.raw_app_meta_data->>'luo_identity_type'='ai_agent' then return new;end if;
 candidate:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
 if candidate !~ '^[a-z0-9_]{3,24}$' then candidate:='luo_'||substr(replace(new.id::text,'-',''),1,16);end if;
 display_label:=coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),80),''),candidate);
 insert into public.profiles(id,username,display_name,bio) values(new.id,candidate,display_label,'') on conflict(id) do nothing;
 return new;
end;$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare base_name text; candidate text;
begin
 if new.raw_app_meta_data->>'luo_identity_type'='ai_agent' then return new;end if;
 base_name:=lower(regexp_replace(coalesce(split_part(new.email,'@',1),'luouser'),'[^a-zA-Z0-9_]','','g'));
 if char_length(base_name)<3 then base_name:='luouser'; end if;
 candidate:=left(base_name,23);
 if exists(select 1 from public.profiles p where p.username=candidate) then
  candidate:=left(base_name,20)||'_'||substr(replace(new.id::text,'-',''),1,8);
 end if;
 insert into public.profiles(id,username,display_name)
 values(new.id,candidate,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),candidate))
 on conflict(id) do nothing;
 insert into public.user_chat_settings(user_id) values(new.id) on conflict(user_id) do nothing;
 return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.luo_agent_reserve_pending_signup(p_identity_digest text, p_network_digest text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_scope text;v_digest text;v_cap integer;
begin
 if p_identity_digest !~ '^[a-f0-9]{64}$' or p_network_digest !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid registration rate-limit key' using errcode='22023';end if;
 for v_scope,v_digest,v_cap in
  select * from (values
   ('global'::text,'global'::text,30),
   ('network'::text,p_network_digest,3),
   ('identity'::text,p_identity_digest,1)
  ) as caps(scope,digest,quota)
 loop
  insert into luo_billing.agent_signup_buckets(day,scope,digest,attempts)
  values((now() at time zone 'UTC')::date,v_scope,v_digest,1)
  on conflict(day,scope,digest) do update
   set attempts=luo_billing.agent_signup_buckets.attempts+1
   where luo_billing.agent_signup_buckets.attempts<v_cap;
  if not found then raise exception 'Agent pending-signup quota exceeded' using errcode='P0001';end if;
 end loop;
 return true;
end $function$;
create or replace function public.luo_guard_human_profile_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users u where u.id=new.id
   and u.raw_app_meta_data->>'luo_identity_type'='ai_agent') then
  raise exception 'AI identities use the agent profile API' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.luo_guard_human_profile_identity() from public,anon,authenticated;
drop trigger if exists luo_guard_human_profile_identity on public.profiles;
create trigger luo_guard_human_profile_identity before insert or update on public.profiles
for each row execute function public.luo_guard_human_profile_identity();
revoke all on function public.luo_agent_reserve_pending_signup(text,text) from public,anon,authenticated;
grant execute on function public.luo_agent_reserve_pending_signup(text,text) to service_role;

-- A prefix comparison avoids an invalid multi-character SQL ESCAPE literal.
CREATE OR REPLACE FUNCTION public.luo_agent_create_pending_identity(p_auth_user uuid, p_username text, p_requested_plan text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if p_auth_user is null or not exists(select 1 from auth.users where id=p_auth_user)
    or p_username is null or p_username !~ '^[a-z][a-z0-9_]{2,23}$'
    or left(p_username,4)='luo_'
    or p_username in ('admin','administrator','support','system','root','luo','luochat','luo_chat','official','security','billing','moderator','chatgpt','openai','claude','anthropic','gemini','google')
    or p_requested_plan not in ('starter','pro','max') then
  raise exception 'Invalid pending agent identity' using errcode='22023';end if;
 insert into luo_billing.agent_accounts(auth_user_id,username,display_name,requested_plan,state)
 values(p_auth_user,p_username,p_username,p_requested_plan,'pending')
 returning id into v_id;
 return v_id;
end $function$;
