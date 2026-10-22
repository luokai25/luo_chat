-- Opaque worker credential is generated and consumed entirely on the server.
-- Neither migrations nor browser code contain its value.
create extension if not exists pg_net with schema extensions;
create table public.chat_cleanup_worker_config(id boolean primary key default true check(id),token_sha256 text not null);
alter table public.chat_cleanup_worker_config enable row level security;
revoke all on public.chat_cleanup_worker_config from public,anon,authenticated;
grant select on public.chat_cleanup_worker_config to service_role;
do $$declare token text;begin
 token:=encode(extensions.gen_random_bytes(32),'hex');
 perform vault.create_secret(token,'luo_chat_cleanup_worker','Scoped storage-cleanup scheduler credential');
 insert into public.chat_cleanup_worker_config(id,token_sha256) values(true,encode(extensions.digest(token,'sha256'),'hex'));
end;$$;
-- No secret is embedded in the cron command. Vault access occurs at execution.
select cron.schedule('luo-storage-cleanup','*/5 * * * *',$job$
select net.http_post(
 url:='https://byjixqwpjvsgmqilmzbm.supabase.co/functions/v1/cleanup-chat-media',
 headers:=jsonb_build_object('Content-Type','application/json','x-luo-cleanup-token',(select decrypted_secret from vault.decrypted_secrets where name='luo_chat_cleanup_worker')),
 body:='{}'::jsonb,timeout_milliseconds:=30000);
$job$);
