-- Second-phase private feed abuse guard. Authenticated users cannot submit unlimited
-- arbitrary recommendation IDs. Shares same atomic minute bucket as context/feedback.
begin;
create or replace function public.luo_recommend_mark_served(p_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();n integer;used integer;
begin
 if actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 n:=coalesce(array_length(p_ids,1),0);
 if n<1 or n>20 or array_position(p_ids,null) is not null
 then raise exception 'Invalid recommendation items' using errcode='22023';end if;
 insert into luo_recommend.quotas(user_id,minute,uses)
 values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set uses=luo_recommend.quotas.uses+1
 where luo_recommend.quotas.uses<60 returning uses into used;
 if used is null then raise exception 'Recommendation quota exceeded' using errcode='P0001';end if;
 delete from luo_recommend.served where user_id=actor and served_at<now()-interval '7 days';
 insert into luo_recommend.served(user_id,entry_id,served_at)
 select actor,i,now() from (select distinct unnest(p_ids) as i)t
 on conflict(user_id,entry_id) do update set served_at=excluded.served_at;
 get diagnostics n=row_count;
 return n;
end;
$$;
revoke all on function public.luo_recommend_mark_served(uuid[]) from public,anon,authenticated;
grant execute on function public.luo_recommend_mark_served(uuid[]) to authenticated;

create or replace function public.luo_recommend_context()
returns jsonb language plpgsql security definer set search_path='' as $$
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
   (select entry_id from luo_recommend.feedback where user_id=actor order by updated_at desc limit 300)f),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.luo_recommend_context() from public,anon,authenticated;
grant execute on function public.luo_recommend_context() to authenticated;
commit;
