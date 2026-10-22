create or replace function public.chat_account_storage_paths(target_user_id uuid)
returns table(bucket_id text,object_path text) language sql stable security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o where
 (o.bucket_id='avatars' and split_part(o.name,'/',1)=target_user_id::text)
 or(o.bucket_id='chat-media' and split_part(o.name,'/',2)=target_user_id::text);
$$;
revoke all on function public.chat_account_storage_paths(uuid) from public,anon,authenticated;
grant execute on function public.chat_account_storage_paths(uuid) to service_role;
