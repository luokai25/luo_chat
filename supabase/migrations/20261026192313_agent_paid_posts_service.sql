-- Staging-only paid agent post board. It does not publish into human feeds.
-- The old human social RPC and minor accounts are not involved.
begin;
create table if not exists luo_billing.agent_public_posts(
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 operation_id uuid not null,
 body text not null check(length(body) between 1 and 2000),
 published boolean not null default true,
 created_at timestamptz not null default now(),
 unique(agent_id,operation_id)
);
alter table luo_billing.agent_public_posts enable row level security;
revoke all on luo_billing.agent_public_posts from public,anon,authenticated;
create index if not exists luo_agent_post_timeline
 on luo_billing.agent_public_posts(created_at desc,id desc) where published;

create or replace function public.luo_agent_publish_post(
 p_agent uuid,p_operation uuid,p_body text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing luo_billing.agent_public_posts%rowtype; created luo_billing.agent_public_posts%rowtype;
begin
 if p_agent is null or p_operation is null or p_body is null
 or length(btrim(p_body))<1 or length(p_body)>2000
 then raise exception 'Invalid agent post' using errcode='22023';end if;
 if not public.luo_agent_has_active_entitlement(p_agent)
 then raise exception 'Paid agent membership required' using errcode='28000';end if;
 -- Serialize one author's retries; a re-sent operation cannot consume another post quota.
 perform pg_advisory_xact_lock(hashtextextended(p_agent::text,917613));
 select * into existing from luo_billing.agent_public_posts
 where agent_id=p_agent and operation_id=p_operation;
 if found then
  if existing.body<>p_body then raise exception 'Operation id belongs to another post' using errcode='23505';end if;
  return jsonb_build_object('id',existing.id,'created_at',existing.created_at,
   'published',existing.published,'duplicate',true,'identity_label','AI Agent');
 end if;
 perform public.luo_agent_consume_quota(p_agent,'post');
 insert into luo_billing.agent_public_posts(agent_id,operation_id,body)
 values(p_agent,p_operation,p_body) returning * into created;
 return jsonb_build_object('id',created.id,'created_at',created.created_at,
  'published',true,'duplicate',false,'identity_label','AI Agent');
end;
$$;
revoke all on function public.luo_agent_publish_post(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_publish_post(uuid,uuid,text) to service_role;

create or replace function public.luo_agent_read_public_posts(
 p_agent uuid,p_before timestamptz,p_before_id uuid,p_limit integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
    'identity_label','AI Agent','body',p.body,'created_at',p.created_at) item
  from luo_billing.agent_public_posts p
  join luo_billing.agent_accounts a on a.id=p.agent_id and a.state='active'
  where p.published
    and exists(select 1 from luo_billing.billing_subscriptions s
      where s.agent_id=a.id and s.status='active' and s.paid_through>now())
    and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
  order by p.created_at desc,p.id desc limit p_limit
 )x;
 return result;
end;
$$;
revoke all on function public.luo_agent_read_public_posts(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.luo_agent_read_public_posts(uuid,timestamptz,uuid,integer) to service_role;

create or replace function public.luo_agent_delete_post(p_agent uuid,p_post uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_agent is null or p_post is null or not public.luo_agent_has_active_entitlement(p_agent)
 then raise exception 'Agent identity unavailable' using errcode='28000';end if;
 update luo_billing.agent_public_posts set published=false
 where id=p_post and agent_id=p_agent and published=true;
 get diagnostics n=row_count;
 return n>0;
end;
$$;
revoke all on function public.luo_agent_delete_post(uuid,uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_delete_post(uuid,uuid) to service_role;
commit;
