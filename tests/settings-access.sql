begin;
insert into auth.users(id,email,raw_user_meta_data) values
('e4141414-1414-4414-8414-141414141414','settings-a@example.invalid','{"username":"settings_fixture_a"}'),
('e5151515-1515-4515-8515-151515151515','settings-b@example.invalid','{"username":"settings_fixture_b"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e4141414-1414-4414-8414-141414141414","role":"authenticated"}',true);
insert into public.user_chat_settings(user_id,wallpaper,message_bubble,auto_download_media,focus_mode) values(auth.uid(),'grid','square',true,true) on conflict(user_id) do update set wallpaper=excluded.wallpaper,message_bubble=excluded.message_bubble,auto_download_media=excluded.auto_download_media,focus_mode=excluded.focus_mode;
select public.set_my_notification_preferences(false,true,true,true,'22:00','08:00','UTC');
select public.set_my_chat_avatar(null);
do $$ begin
 if not exists(select 1 from public.user_chat_settings where user_id=auth.uid() and wallpaper='grid' and focus_mode) then raise exception 'Own appearance save failed';end if;
 if not exists(select 1 from public.user_notification_preferences where user_id=auth.uid() and not direct_messages and quiet_hours_enabled and time_zone='UTC') then raise exception 'Own alert save failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"e5151515-1515-4515-8515-151515151515","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.user_chat_settings where user_id='e4141414-1414-4414-8414-141414141414') then raise exception 'Appearance exposed';end if;
 if exists(select 1 from public.user_notification_preferences where user_id='e4141414-1414-4414-8414-141414141414') then raise exception 'Alerts exposed';end if;
 begin
 insert into public.user_chat_settings(user_id,wallpaper) values('e4141414-1414-4414-8414-141414141414','plain') on conflict(user_id) do update set wallpaper='plain';
 raise exception 'Cross-user settings write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: own appearance save, notification RPC save, avatar removal RPC, cross-user appearance/alert isolation, denied cross-user write' as verification;
rollback;
