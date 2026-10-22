-- Metadata-only fixtures; no real user data or stored file bytes. Always rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('dc121212-1212-4212-8212-121212121212','vault-isolation-a@example.invalid','{"username":"vault_isolation_a"}'),
('dc232323-2323-4323-8323-232323232323','vault-isolation-b@example.invalid','{"username":"vault_isolation_b"}');
insert into public.chat_vault_files(id,user_id,object_path,file_name,mime_type,byte_size) values
('dc343434-3434-4434-8434-343434343434','dc121212-1212-4212-8212-121212121212','dc121212-1212-4212-8212-121212121212/fixture.txt','private-fixture.txt','text/plain',1);
insert into public.chat_vault_items(id,user_id,origin_message_id,body) values
('dc454545-4545-4454-8454-454545454545','dc121212-1212-4212-8212-121212121212',gen_random_uuid(),'Private snapshot fixture');
insert into storage.objects(bucket_id,name,owner_id,metadata) values
('luo-vault','dc121212-1212-4212-8212-121212121212/fixture.txt','dc121212-1212-4212-8212-121212121212','{"mimetype":"text/plain","size":1}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dc232323-2323-4323-8323-232323232323","role":"authenticated"}',true);
do $$declare affected integer;begin
 if exists(select 1 from public.chat_vault_files where id='dc343434-3434-4434-8434-343434343434') then raise exception 'Foreign vault file metadata leaked';end if;
 if exists(select 1 from public.chat_vault_items where id='dc454545-4545-4454-8454-454545454545') then raise exception 'Foreign snapshot leaked';end if;
 if exists(select 1 from storage.objects where bucket_id='luo-vault' and name='dc121212-1212-4212-8212-121212121212/fixture.txt') then raise exception 'Foreign stored object leaked';end if;
 update public.chat_vault_files set note='intruder' where id='dc343434-3434-4434-8434-343434343434';get diagnostics affected=row_count;if affected<>0 then raise exception 'Foreign file edited';end if;
 update public.chat_vault_items set note='intruder' where id='dc454545-4545-4454-8454-454545454545';get diagnostics affected=row_count;if affected<>0 then raise exception 'Foreign snapshot edited';end if;
 delete from public.chat_vault_files where id='dc343434-3434-4434-8434-343434343434';get diagnostics affected=row_count;if affected<>0 then raise exception 'Foreign file deleted';end if;
 delete from public.chat_vault_items where id='dc454545-4545-4454-8454-454545454545';get diagnostics affected=row_count;if affected<>0 then raise exception 'Foreign snapshot deleted';end if;
 begin perform public.commit_private_vault_file('dc121212-1212-4212-8212-121212121212/fixture.txt','copy.txt','text/plain',1,'Stolen');raise exception 'Foreign file claimed';exception when raise_exception then if sqlerrm='Foreign file claimed' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"dc121212-1212-4212-8212-121212121212","role":"authenticated"}',true);
do $$declare affected integer;begin
 update public.chat_vault_files set collection='Updated',note='Owner note' where id='dc343434-3434-4434-8434-343434343434';get diagnostics affected=row_count;if affected<>1 then raise exception 'Owner file edit broken';end if;
 update public.chat_vault_items set collection='Updated',note='Owner note' where id='dc454545-4545-4454-8454-454545454545';get diagnostics affected=row_count;if affected<>1 then raise exception 'Owner snapshot edit broken';end if;
 begin update public.chat_vault_files set object_path='dc232323-2323-4323-8323-232323232323/foreign.txt';raise exception 'File pointer mutable';exception when insufficient_privilege then null;end;
 begin update public.chat_vault_files set mime_type='text/html',byte_size=100;raise exception 'File metadata mutable';exception when insufficient_privilege then null;end;
 begin update public.chat_vault_items set body='Forged snapshot',origin_message_id=gen_random_uuid();raise exception 'Snapshot source mutable';exception when insufficient_privilege then null;end;
 if not exists(select 1 from storage.objects where bucket_id='luo-vault' and name='dc121212-1212-4212-8212-121212121212/fixture.txt') then raise exception 'Owner object access broken';end if;
end $$;
reset role;
rollback;
select 'PASS: foreign vault rows and Storage hidden; foreign edits/deletes/claim denied; owner notes editable; pointers and snapshots immutable' as verification;
