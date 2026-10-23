-- Activate only after verifying username-only register via Edge and
-- recovery-code storage against Supabase Auth. This intentionally closes
-- direct /auth/v1/signup (email/phone/OAuth) registration bypasses.
-- Existing auth.users sessions, emails, passwords and identities are unchanged.
begin;
create or replace function luo_internal.enforce_server_only_signup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'luo_registration_v2','') <> 'approved'
   or coalesce(new.email,'') !~ '^luo-[a-f0-9]{32}@accounts[.]invalid$'
 then
   raise exception 'Registration must use Luo Chat username signup.'
     using errcode='28000';
 end if;
 return new;
end;$$;
revoke all on function luo_internal.enforce_server_only_signup() from public,anon,authenticated;
drop trigger if exists enforce_server_only_signup on auth.users;
create trigger enforce_server_only_signup before insert on auth.users
for each row execute function luo_internal.enforce_server_only_signup();
commit;
