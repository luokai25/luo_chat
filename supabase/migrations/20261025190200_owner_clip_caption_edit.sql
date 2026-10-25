-- Author-only published clip title/caption editing. No media, audience or ownership mutations.
-- This migration requires the existing luo_internal.space_entries and space_limits tables.
begin;
create table if not exists luo_internal.clip_caption_revisions(
 id bigint generated always as identity primary key,
 clip_id uuid not null,
 owner_id uuid not null,
 old_title text not null,
 old_caption text not null,
 new_title text not null,
 new_caption text not null,
 edited_at timestamptz not null default now()
);
alter table luo_internal.clip_caption_revisions enable row level security;
revoke all on luo_internal.clip_caption_revisions from public,anon,authenticated;
revoke all on sequence luo_internal.clip_caption_revisions_id_seq from public,anon,authenticated;

create function public.luo_clip_edit(target_clip uuid,new_title text,new_caption text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
declare previous luo_internal.space_entries%rowtype;
declare used integer;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 if target_clip is null or new_title is null or new_caption is null
    or char_length(new_title)>160 or char_length(new_caption)>4000
    or (btrim(new_title)='' and btrim(new_caption)='')
    or new_title<>btrim(new_title) or new_caption<>btrim(new_caption)
 then raise exception 'Invalid clip caption or title' using errcode='22023';end if;
 insert into luo_internal.space_limits(user_id,slot,uses)
 values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,slot) do update set uses=luo_internal.space_limits.uses+1
 where luo_internal.space_limits.uses<40 returning uses into used;
 if used is null then raise exception 'Please slow down and try again in a minute' using errcode='P0001';end if;
 select * into previous from luo_internal.space_entries
 where id=target_clip and owner_id=actor and kind='clip' and published=true
 for update;
 if not found then raise exception 'Only the author can edit a published clip' using errcode='42501';end if;
 insert into luo_internal.clip_caption_revisions(clip_id,owner_id,old_title,old_caption,new_title,new_caption)
 values(target_clip,actor,previous.title,previous.body,new_title,new_caption);
 update luo_internal.space_entries set title=new_title,body=new_caption,updated_at=now()
 where id=target_clip and owner_id=actor and kind='clip' and published=true;
 return jsonb_build_object('id',target_clip,'title',new_title,'body',new_caption,'updated',true);
end $$;
revoke all on function public.luo_clip_edit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.luo_clip_edit(uuid,text,text) to authenticated;
commit;
