-- Private user-muted topic and keyword preferences for X-inspired ranking.
-- Viewer-scoped, no identity or age-document requirement. Content safety rules
-- are separate; this migration never authorizes feeds or releases private posts.
begin;
create table if not exists luo_recommend.muted_terms(
 user_id uuid not null references auth.users(id) on delete cascade,
 term text not null check(char_length(term) between 3 and 80),
 created_at timestamptz not null default now(),
 primary key(user_id,term)
);
alter table luo_recommend.muted_terms enable row level security;
revoke all on luo_recommend.muted_terms from public,anon,authenticated;
create index if not exists luo_recommend_muted_terms_recent
 on luo_recommend.muted_terms(user_id,created_at desc);
CREATE OR REPLACE FUNCTION public.luo_recommend_update_mute(p_action text, p_term text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); normalized text;used integer;result jsonb;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 normalized:=lower(regexp_replace(btrim(coalesce(p_term,'')),'[[:space:]]+',' ','g'));
 if p_action not in ('add','remove') or char_length(normalized)<3 or
  char_length(normalized)>80 then
  raise exception 'Invalid mute preference' using errcode='22023';end if;
 insert into luo_recommend.quotas(user_id,minute,uses)
 values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set uses=luo_recommend.quotas.uses+1
 where luo_recommend.quotas.uses<60 returning uses into used;
 if used is null then raise exception 'Recommendation quota exceeded' using errcode='P0001';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,1711984));
 if p_action='add' then
  if (select count(*) from luo_recommend.muted_terms where user_id=actor)>=30 and
     not exists(select 1 from luo_recommend.muted_terms where user_id=actor and term=normalized)
  then raise exception 'Mute list full' using errcode='P0001';end if;
  insert into luo_recommend.muted_terms(user_id,term)values(actor,normalized)
  on conflict(user_id,term) do nothing;
 else
  delete from luo_recommend.muted_terms where user_id=actor and term=normalized;
 end if;
 select coalesce(jsonb_agg(term order by term),'[]'::jsonb) into result
 from luo_recommend.muted_terms where user_id=actor;
 return result;
end;
$function$;

revoke all on function public.luo_recommend_update_mute(text,text) from public,anon,authenticated;
grant execute on function public.luo_recommend_update_mute(text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.luo_recommend_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();allowed integer;result jsonb;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 insert into luo_recommend.quotas(user_id,minute,uses)
 values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set uses=luo_recommend.quotas.uses+1
 where luo_recommend.quotas.uses<60 returning uses into allowed;
 if allowed is null then raise exception 'Recommendation quota exceeded' using errcode='P0001';end if;
 delete from luo_recommend.served where user_id=actor and served_at<now()-interval '7 days';
 delete from luo_recommend.quotas where user_id=actor and minute<now()-interval '2 days';
 delete from luo_recommend.feedback where user_id=actor and action='not_interested'
 and updated_at<now()-interval '90 days';
 select jsonb_build_object(
  'served_ids',coalesce((select jsonb_agg(s.entry_id) from
   (select entry_id from luo_recommend.served where user_id=actor order by served_at desc limit 300)s),'[]'::jsonb),
  'hidden_ids',coalesce((select jsonb_agg(f.entry_id) from
   (select entry_id from luo_recommend.feedback where user_id=actor order by updated_at desc limit 300)f),'[]'::jsonb),
  'muted_terms',coalesce((select jsonb_agg(t.term) from
   (select term from luo_recommend.muted_terms where user_id=actor order by term limit 30)t),'[]'::jsonb)
 ) into result;
 return result;
end;
$function$;

revoke all on function public.luo_recommend_context() from public,anon,authenticated;
grant execute on function public.luo_recommend_context() to authenticated;
commit;
