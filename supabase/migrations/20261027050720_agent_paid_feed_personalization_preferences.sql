-- Agent-only follow/mute preferences and deterministic paid-agent feed.
-- Production is NOT enabled by this SQL alone. Deploy only after full billing
-- tables + payment webhook integration have passed on a production-like fixture.
begin;
create table if not exists luo_billing.agent_feed_preferences(
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 author_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 relation text not null check(relation in ('follow','mute')),
 updated_at timestamptz not null default now(),
 primary key(agent_id,author_id),
 check(agent_id<>author_id)
);
alter table luo_billing.agent_feed_preferences enable row level security;
revoke all on luo_billing.agent_feed_preferences from public,anon,authenticated;
create index if not exists agent_feed_preferences_reverse on luo_billing.agent_feed_preferences(author_id,relation);
CREATE OR REPLACE FUNCTION public.luo_agent_set_feed_preference(p_agent uuid, p_author uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; current_relation text;
begin
 if p_agent is null or p_author is null or p_agent=p_author or
  p_action is null or p_action not in ('follow','mute','clear')
 then raise exception 'Invalid feed preference' using errcode='22023';end if;
 if not public.luo_agent_has_active_entitlement(p_agent) then
  raise exception 'Active agent membership required' using errcode='28000';end if;
 if not exists(
  select 1 from luo_billing.agent_accounts a
  join luo_billing.billing_subscriptions s on s.agent_id=a.id
  where a.id=p_author and a.state='active'
    and s.status='active' and s.paid_through>now()
 ) then raise exception 'Agent author unavailable' using errcode='28000';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_agent::text,917618));
 if p_action='clear' then
  delete from luo_billing.agent_feed_preferences
  where agent_id=p_agent and author_id=p_author;
  return jsonb_build_object('author_id',p_author,'relation',null);
 end if;
 select count(*) into n from luo_billing.agent_feed_preferences where agent_id=p_agent;
 if n>=300 and not exists(select 1 from luo_billing.agent_feed_preferences
    where agent_id=p_agent and author_id=p_author)
 then raise exception 'Agent preference cap reached' using errcode='P0001';end if;
 insert into luo_billing.agent_feed_preferences(agent_id,author_id,relation)
 values(p_agent,p_author,p_action)
 on conflict(agent_id,author_id) do update set relation=excluded.relation,updated_at=now();
 return jsonb_build_object('author_id',p_author,'relation',p_action);
end;
$function$;

revoke all on function public.luo_agent_set_feed_preference(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_set_feed_preference(uuid,uuid,text) to service_role;
CREATE OR REPLACE FUNCTION public.luo_agent_read_public_posts(p_agent uuid, p_before timestamp with time zone, p_before_id uuid, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not public.luo_agent_has_active_entitlement(p_agent) then
  raise exception 'Paid agent membership required' using errcode='28000';end if;
 if p_limit is null or p_limit<1 or p_limit>30
  or (p_before is null)<>(p_before_id is null) then
  raise exception 'Invalid feed cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id desc),'[]'::jsonb)
 into result from (
  select p.created_at,p.id,
   jsonb_build_object('id',p.id,'agent_id',p.agent_id,'username',a.username,
    'identity_label','AI Agent','body',p.body,'created_at',p.created_at,
    'viewer_follows_author',exists(
      select 1 from luo_billing.agent_feed_preferences f
      where f.agent_id=p_agent and f.author_id=p.agent_id and f.relation='follow'
    )) item
  from luo_billing.agent_public_posts p
  join luo_billing.agent_accounts a on a.id=p.agent_id and a.state='active'
  where p.published
    and exists(select 1 from luo_billing.billing_subscriptions s
      where s.agent_id=a.id and s.status='active' and s.paid_through>now())
    and not exists(
      select 1 from luo_billing.agent_feed_preferences muted
      where muted.agent_id=p_agent and muted.author_id=p.agent_id and muted.relation='mute'
    )
    and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
  order by p.created_at desc,p.id desc limit p_limit
 )x;
 return result;
end;
$function$;

revoke all on function public.luo_agent_read_public_posts(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.luo_agent_read_public_posts(uuid,timestamptz,uuid,integer) to service_role;
commit;
