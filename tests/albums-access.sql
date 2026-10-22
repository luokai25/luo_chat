begin;
insert into auth.users(id,email,raw_user_meta_data) values
('ac111111-1111-4111-8111-111111111111','album-a@example.invalid','{"username":"luo_album_a"}'),('ac222222-2222-4222-8222-222222222222','album-b@example.invalid','{"username":"luo_album_b"}'),('ac333333-3333-4333-8333-333333333333','album-c@example.invalid','{"username":"luo_album_c"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ac111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select set_config('album.room',public.start_direct_chat('luo_album_b')::text,true);
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata,user_metadata) values('chat-media',current_setting('album.room')||'/ac111111-1111-4111-8111-111111111111/album-upload-one','ac111111-1111-4111-8111-111111111111','{"size":10,"mimetype":"image/png"}',jsonb_build_object('checksum',repeat('a',64)));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ac111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$declare room uuid:=current_setting('album.room')::uuid;path text:=room||'/'||auth.uid()||'/album-upload-one';m public.chat_messages;again public.chat_messages;album uuid:='ac444444-4444-4444-8444-444444444444';begin
 m=public.send_luo_album_item(room,'album-upload-one','Caption',path,'photo.png','image/png',10,repeat('a',64),album,0,2);
 again=public.send_luo_album_item(room,'album-upload-one','Caption',path,'photo.png','image/png',10,repeat('a',64),album,0,2);
 if m.id<>again.id or m.album_id<>album or m.album_index<>0 or m.album_total<>2 then raise exception 'Album metadata or retry broken';end if;
 if(select count(*) from public.chat_attachments where message_id=m.id)<>1 then raise exception 'Album attachment duplicated';end if;
 perform set_config('album.message',m.id::text,true);
 begin perform public.send_luo_album_item(room,'album-upload-one','Caption',path,'photo.png','image/png',10,repeat('a',64),album,1,2);raise exception 'Retry altered album index';exception when raise_exception then if sqlerrm='Retry altered album index' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"sub":"ac222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$begin
 if not exists(select 1 from public.chat_messages where id=current_setting('album.message')::uuid and album_total=2)then raise exception 'Recipient album unavailable';end if;
 begin perform public.send_luo_album_item(current_setting('album.room')::uuid,'foreign-album-operation','Foreign','missing','foreign.png','image/png',10,repeat('a',64),'ac444444-4444-4444-8444-444444444444',1,2);raise exception 'Peer hijacked album';exception when raise_exception then if sqlerrm='Peer hijacked album' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"sub":"ac333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.chat_albums where id='ac444444-4444-4444-8444-444444444444')then raise exception 'Outsider album leaked';end if;end$$;
reset role;
rollback;
select 'PASS: checked album upload, stable retry, immutable item order, recipient access, cross-sender hijack rejection and outsider isolation' as verification;
