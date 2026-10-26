begin;
alter table luo_agent_verify.requests
 add column proof_attempts integer not null default 0 check (proof_attempts between 0 and 8);
create function public.luo_agent_verify_attempt(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row luo_agent_verify.requests%rowtype;
begin
 update luo_agent_verify.requests
  set proof_attempts=proof_attempts+1
  where id=p_id and state='pending' and expires_at>now() and proof_attempts<8
 returning * into v_row;
 if v_row.id is null then return null;end if;
 return jsonb_build_object('id',v_row.id,'username',v_row.username,
 'public_key',v_row.public_key,'challenge_nonce',v_row.challenge_nonce,
 'state',v_row.state,'expires_at',v_row.expires_at);
end;$$;
revoke all on function public.luo_agent_verify_attempt(uuid) from public,anon,authenticated;
grant execute on function public.luo_agent_verify_attempt(uuid) to service_role;
commit;