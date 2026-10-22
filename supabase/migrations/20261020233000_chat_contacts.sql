-- Contacts are private to their owner. Names are resolved from profiles at read time.
create table if not exists public.chat_contacts (
 owner_id uuid not null references auth.users(id) on delete cascade,
 contact_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(owner_id,contact_id), check(owner_id <> contact_id)
);
alter table public.chat_contacts enable row level security;
revoke all on public.chat_contacts from anon, authenticated;
grant select,delete on public.chat_contacts to authenticated;
create policy contacts_own_read on public.chat_contacts for select to authenticated using (owner_id=(select auth.uid()));
create policy contacts_own_delete on public.chat_contacts for delete to authenticated using (owner_id=(select auth.uid()));
create or replace function public.save_chat_contact(target_username text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target uuid;
begin
 if actor is null then raise exception 'Sign in required'; end if;
 select id into target from public.profiles where username=lower(trim(target_username));
 if target is null or target=actor then raise exception 'Choose another valid username'; end if;
 insert into public.chat_contacts(owner_id,contact_id) values(actor,target) on conflict do nothing;
end; $$;
create or replace function public.get_my_chat_contacts() returns table(id uuid,username text,display_name text) language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.username,p.display_name from public.chat_contacts c join public.profiles p on p.id=c.contact_id where c.owner_id=auth.uid() order by lower(p.display_name),p.username;
$$;
revoke all on function public.save_chat_contact(text), public.get_my_chat_contacts() from public,anon;
grant execute on function public.save_chat_contact(text), public.get_my_chat_contacts() to authenticated;
