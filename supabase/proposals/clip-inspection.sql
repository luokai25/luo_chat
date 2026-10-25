-- UNAPPLIED staging proposal. Not a generated migration. No hosted execution.
-- Storage version + receipt immutability matter: a path/hash alone is insufficient.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table luo_internal.clip_inspections(
 object_id uuid primary key,bucket_id text not null check(bucket_id='luo-social'),
 object_path text not null,object_version text not null,owner_id uuid not null references auth.users(id) on delete cascade,
 sha256 text not null check(sha256~'^[0-9a-f]{64}$'),
 byte_size bigint not null check(byte_size between 1 and 52428800),
 duration double precision not null check(duration>0 and duration<=90),
 width integer not null check(width between 1 and 2160),height integer not null check(height between 1 and 2160),
 mime_type text not null check(mime_type in('video/mp4','video/webm')),
 policy text not null check(policy='luo-reel-v1'),created_at timestamptz not null default now(),
 unique(bucket_id,object_path),check(width::bigint*height<=4147200)
);
alter table luo_internal.clip_inspections enable row level security;
revoke all on luo_internal.clip_inspections from public,anon,authenticated;

create function luo_internal.inspected_path_reserved(bucket text,path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from luo_internal.clip_inspections i where i.bucket_id=bucket and i.object_path=path)
$$;
revoke all on function luo_internal.inspected_path_reserved(text,text) from public,anon;
grant execute on function luo_internal.inspected_path_reserved(text,text) to authenticated;
-- No luo_internal schema USAGE is granted to browser roles. Policy expressions
-- can use their stored function OID without exposing schema lookup to clients.
create policy inspected_clip_insert_guard on storage.objects as restrictive for insert to authenticated
 with check(not luo_internal.inspected_path_reserved(bucket_id,name));
create policy inspected_clip_update_guard on storage.objects as restrictive for update to authenticated
 using(not luo_internal.inspected_path_reserved(bucket_id,name))
 with check(not luo_internal.inspected_path_reserved(bucket_id,name));
create policy inspected_clip_delete_guard on storage.objects as restrictive for delete to authenticated
 using(not luo_internal.inspected_path_reserved(bucket_id,name));

-- RLS predicates alone may have a pre-inspection statement snapshot. A volatile
-- trigger also checks after acquiring a transaction path lock. Try-lock rather
-- than waiting avoids row-lock/path-lock inversions with Storage INSERT/upsert.
create function luo_internal.guard_inspected_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare bucket text;path text;
begin
 if current_setting('role',true) not in('anon','authenticated') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_op='DELETE' then bucket:=old.bucket_id;path:=old.name;else bucket:=new.bucket_id;path:=new.name;end if;
 if bucket='luo-social' or(tg_op='UPDATE' and old.bucket_id='luo-social') then
  if not pg_try_advisory_xact_lock(hashtextextended(bucket||'/'||path,20261025)) then raise exception 'Media object busy; retry';end if;
  if tg_op='UPDATE' and not pg_try_advisory_xact_lock(hashtextextended(old.bucket_id||'/'||old.name,20261025)) then raise exception 'Media object busy; retry';end if;
  if exists(select 1 from luo_internal.clip_inspections i where i.bucket_id=bucket and i.object_path=path)
   or(tg_op='UPDATE' and exists(select 1 from luo_internal.clip_inspections i where i.bucket_id=old.bucket_id and i.object_path=old.name))
  then raise exception 'Inspected media is immutable';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function luo_internal.guard_inspected_storage() from public,anon,authenticated;
create trigger inspected_storage_immutable before insert or update or delete on storage.objects
 for each row execute function luo_internal.guard_inspected_storage();

create function public.get_luo_clip_inspection_source(path text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'version',s.version,'ownerId',s.owner_id,
 'byteSize',(s.metadata->>'size')::bigint,'mimeType',s.metadata->>'mimetype')
 from storage.objects s where s.bucket_id='luo-social' and s.name=path
$$;
revoke all on function public.get_luo_clip_inspection_source(text) from public,anon,authenticated;
grant execute on function public.get_luo_clip_inspection_source(text) to service_role;

create function public.record_luo_clip_inspection(path text,object_id uuid,object_version text,sha256 text,
 byte_size bigint,duration double precision,width integer,height integer,mime_type text,policy text)
returns void language plpgsql security definer set search_path='' as $$
#variable_conflict error
declare o storage.objects;previous luo_internal.clip_inspections;
begin
 select * into o from storage.objects s where s.bucket_id='luo-social' and s.name=path for update;
 if o.id is null or o.id is distinct from object_id or o.version is distinct from object_version
 or o.metadata->>'mimetype' is distinct from mime_type or (o.metadata->>'size')::bigint is distinct from byte_size
 then raise exception 'Inspected object changed or is unavailable';end if;
 if not pg_try_advisory_xact_lock(hashtextextended(o.bucket_id||'/'||o.name,20261025)) then raise exception 'Media object busy; retry';end if;
 select * into previous from luo_internal.clip_inspections i where i.object_id=o.id;
 if previous.object_id is not null then
  if (previous.bucket_id,previous.object_path,previous.owner_id,previous.object_version,previous.sha256,previous.byte_size,previous.duration,previous.width,previous.height,previous.mime_type,previous.policy)
   is distinct from (o.bucket_id,o.name,o.owner_id::uuid,object_version,sha256,byte_size,duration,width,height,mime_type,policy) then raise exception 'Inspection retry conflict';end if;
  return;
 end if;
 insert into luo_internal.clip_inspections(object_id,bucket_id,object_path,object_version,owner_id,sha256,byte_size,duration,width,height,mime_type,policy)
 values(o.id,o.bucket_id,o.name,o.version,o.owner_id::uuid,sha256,byte_size,duration,width,height,mime_type,policy);
end;$$;
revoke all on function public.record_luo_clip_inspection(text,uuid,text,text,bigint,double precision,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.record_luo_clip_inspection(text,uuid,text,text,bigint,double precision,integer,integer,text,text) to service_role;

create function luo_internal.require_inspected_clip() returns trigger
language plpgsql security definer set search_path='' as $$
declare path text;receipt luo_internal.clip_inspections;o storage.objects;
begin
 if new.kind<>'clip' or not new.published then return new;end if;
 if jsonb_typeof(new.media) is distinct from 'array' or jsonb_array_length(new.media)<>1 then raise exception 'One inspected video is required';end if;
 path:=new.media->0->>'path';
 if path is null or path not like new.owner_id::text||'/'||new.id::text||'/%' then raise exception 'Invalid inspected clip path';end if;
 select * into o from storage.objects s where s.bucket_id='luo-social' and s.name=path for share;
 select * into receipt from luo_internal.clip_inspections i where i.bucket_id='luo-social' and i.object_path=path;
 if receipt.object_id is null or receipt.owner_id is distinct from new.owner_id or receipt.object_id is distinct from o.id
 or receipt.object_version is distinct from o.version or o.owner_id is distinct from new.owner_id::text
 or (o.metadata->>'size')::bigint is distinct from receipt.byte_size or o.metadata->>'mimetype' is distinct from receipt.mime_type
 then raise exception 'Clip is waiting for trusted media inspection';end if;
 new.media:=jsonb_build_array((new.media->0)||jsonb_build_object('duration',receipt.duration));
 return new;
end;$$;
revoke all on function luo_internal.require_inspected_clip() from public,anon,authenticated;
create trigger require_trusted_clip before insert or update on luo_internal.space_entries
 for each row execute function luo_internal.require_inspected_clip();
commit;
