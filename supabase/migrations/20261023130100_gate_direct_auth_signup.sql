-- Activate only AFTER backend signup and recovery migrations are validated.
-- Supabase Auth adminCreateUser writes app_metadata AFTER its initial user INSERT
-- within the same transaction. Therefore an ordinary BEFORE INSERT check would
-- reject legitimate registrations. Validate at transaction commit instead.
-- Existing users and sessions are not modified.
begin;
create or replace function luo_internal.enforce_server_only_signup()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_email text;current_metadata jsonb;
begin
 select u.email,u.raw_app_meta_data into current_email,current_metadata
 from auth.users u where u.id=new.id;
 if coalesce(current_metadata->>'luo_registration_v2','') <> 'approved'
    or coalesce(current_email,'') !~ '^luo-[a-f0-9]{32}@accounts[.]invalid$'
 then
   raise exception 'New accounts must use Luo Chat username signup.'
     using errcode='28000';
 end if;
 return new;
end;$$;
revoke all on function luo_internal.enforce_server_only_signup() from public,anon,authenticated;
drop trigger if exists enforce_server_only_signup on auth.users;
create constraint trigger enforce_server_only_signup after insert on auth.users
deferrable initially deferred for each row
execute function luo_internal.enforce_server_only_signup();
commit;
