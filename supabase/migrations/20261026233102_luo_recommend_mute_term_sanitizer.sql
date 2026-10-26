-- Idempotent restatement of the sanitized normalized-muted-term RPC.
-- Staging was applied before the SQL source was committed; this guarantees
-- reproducing the latest fixed definition without any invalid character check.
begin;
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
commit;
