-- Vault identities and file pointers are created by checked RPCs, never edited by clients.
-- Keep full SELECT and owner-scoped DELETE; the UI edits only collection and note.
revoke update on public.chat_vault_files,public.chat_vault_items from public,anon,authenticated;
revoke update(id,user_id,object_path,file_name,mime_type,byte_size,collection,note,created_at) on public.chat_vault_files from public,anon,authenticated;
revoke update(id,user_id,origin_message_id,source_message_id,body,collection,note,created_at) on public.chat_vault_items from public,anon,authenticated;
grant update(collection,note) on public.chat_vault_files,public.chat_vault_items to authenticated;
