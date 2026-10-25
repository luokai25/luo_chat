-- Isolated agent-to-agent staging transport. NO human chat, minor DM or production data access.
begin;
create table luo_billing.agent_peer_connections(
 agent_low uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 agent_high uuid not null references luo_billing.agent_accounts(id) on delete cascade,
 low_approved boolean not null default false,
 high_approved boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(agent_low,agent_high),check(agent_low<agent_high)
);
create table luo_billing.agent_peer_messages(
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references luo_billing.agent_accounts(id) on delete restrict,
 recipient uuid not null references luo_billing.agent_accounts(id) on delete restrict,
 client_message_id uuid not null,
 text_content text not null check(length(text_content) between 1 and 4000),
 sent_at timestamptz not null default now(),
 unique(sender,client_message_id),
 check(sender<>recipient)
);
create index on luo_billing.agent_peer_messages(sender,recipient,sent_at desc);
create index on luo_billing.agent_peer_messages(recipient,sender,sent_at desc);
alter table luo_billing.agent_peer_connections enable row level security;
alter table luo_billing.agent_peer_messages enable row level security;
revoke all on luo_billing.agent_peer_connections,luo_billing.agent_peer_messages from public,anon,authenticated;
create function public.luo_agent_find_peer(p_actor uuid,p_username text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'username',b.username,'identity_label','AI Agent')
 from luo_billing.agent_accounts b
 where p_username=b.username and b.id<>p_actor and b.state='active'
  and public.luo_agent_has_active_entitlement(p_actor)
  and public.luo_agent_has_active_entitlement(b.id) limit 1;
$$;
revoke all on function public.luo_agent_find_peer(uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_find_peer(uuid,text) to service_role;

create function public.luo_agent_approve_peer(p_actor uuid,p_other uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row luo_billing.agent_peer_connections%rowtype;v_lo uuid;v_hi uuid;
begin
 if p_actor is null or p_other is null or p_actor=p_other
 or not public.luo_agent_has_active_entitlement(p_actor)
 or not public.luo_agent_has_active_entitlement(p_other) then
 raise exception 'Agent contact not authorized' using errcode='28000';end if;
 v_lo:=least(p_actor,p_other);v_hi:=greatest(p_actor,p_other);
 insert into luo_billing.agent_peer_connections(agent_low,agent_high,low_approved,high_approved)
 values(v_lo,v_hi,p_actor=v_lo,p_actor=v_hi)
 on conflict(agent_low,agent_high) do update
 set low_approved=luo_billing.agent_peer_connections.low_approved or excluded.low_approved,
     high_approved=luo_billing.agent_peer_connections.high_approved or excluded.high_approved,
     updated_at=now()
 returning * into v_row;
 return jsonb_build_object('accepted',v_row.low_approved and v_row.high_approved,
   'peer',p_other,'identity_label','AI Agent');
end $$;
revoke all on function public.luo_agent_approve_peer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_approve_peer(uuid,uuid) to service_role;

create function public.luo_agent_send_peer_message(
 p_sender uuid,p_recipient uuid,p_client_id uuid,p_text text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allowed boolean;v_id uuid;v_old luo_billing.agent_peer_messages%rowtype;
begin
 if p_sender is null or p_recipient is null or p_client_id is null
 or p_sender=p_recipient or p_text is null or char_length(p_text) not between 1 and 4000
 or trim(p_text)='' or not public.luo_agent_has_active_entitlement(p_sender)
 or not public.luo_agent_has_active_entitlement(p_recipient)then
  raise exception 'Agent message disallowed' using errcode='28000';end if;
 select (low_approved and high_approved) into v_allowed
 from luo_billing.agent_peer_connections
 where agent_low=least(p_sender,p_recipient) and agent_high=greatest(p_sender,p_recipient) for update;
 if coalesce(v_allowed,false)=false then
  raise exception 'Both agents must accept contact first' using errcode='28000';end if;
 select * into v_old from luo_billing.agent_peer_messages
 where sender=p_sender and client_message_id=p_client_id;
 if found then
  if v_old.recipient<>p_recipient or v_old.text_content<>p_text then
   raise exception 'Idempotency key reused with changed message' using errcode='23505';end if;
  return jsonb_build_object('id',v_old.id,'deduplicated',true,'identity_label','AI Agent');
 end if;
 perform public.luo_agent_consume_quota(p_sender,'message');
 insert into luo_billing.agent_peer_messages(sender,recipient,client_message_id,text_content)
 values(p_sender,p_recipient,p_client_id,p_text) returning id into v_id;
 return jsonb_build_object('id',v_id,'deduplicated',false,'identity_label','AI Agent');
end $$;
revoke all on function public.luo_agent_send_peer_message(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.luo_agent_send_peer_message(uuid,uuid,uuid,text) to service_role;

create function public.luo_agent_read_peer_messages(p_actor uuid,p_peer uuid,p_limit integer default 30)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',msg.id,'sender',msg.sender,'recipient',msg.recipient,
 'text',msg.text_content,'sent_at',msg.sent_at,'identity_label','AI Agent') order by msg.sent_at desc),'[]'::jsonb)
 from(
  select m.* from luo_billing.agent_peer_messages m
  where ((m.sender=p_actor and m.recipient=p_peer) or (m.sender=p_peer and m.recipient=p_actor))
  and p_limit between 1 and 50
  and public.luo_agent_has_active_entitlement(p_actor)
  and public.luo_agent_has_active_entitlement(p_peer)
  and exists(select 1 from luo_billing.agent_peer_connections c
   where c.agent_low=least(p_actor,p_peer) and c.agent_high=greatest(p_actor,p_peer)
    and c.low_approved and c.high_approved)
  order by m.sent_at desc limit least(greatest(p_limit,1),50)
 ) msg;
$$;
revoke all on function public.luo_agent_read_peer_messages(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.luo_agent_read_peer_messages(uuid,uuid,integer) to service_role;
commit;