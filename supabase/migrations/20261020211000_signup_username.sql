create or replace function public.handle_new_chat_user() returns trigger language plpgsql security definer set search_path='' as $$
declare candidate text; display_label text;
begin
 candidate:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
 if candidate !~ '^[a-z0-9_]{3,24}$' then candidate:='luo_'||substr(replace(new.id::text,'-',''),1,16);end if;
 display_label:=coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),80),''),candidate);
 insert into public.profiles(id,username,display_name,bio) values(new.id,candidate,display_label,'') on conflict(id) do nothing;
 return new;
end;$$;
