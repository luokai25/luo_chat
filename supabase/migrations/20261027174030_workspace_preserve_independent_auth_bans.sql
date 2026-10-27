BEGIN;
CREATE OR REPLACE FUNCTION public.luo_workspace_control(p_action text,p_payload jsonb,p_reason text,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; prior luo_workspace.operator_audit%rowtype; settings luo_workspace.operator_settings%rowtype;
 target uuid; original_ban timestamptz; our_ban timestamptz; result jsonb; old_control luo_workspace.account_controls%rowtype;
BEGIN
 v_actor:=luo_workspace.require_owner();
 IF p_request IS NULL OR p_reason IS NULL OR length(btrim(p_reason))<5 OR length(p_reason)>500 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>2000 THEN RAISE EXCEPTION 'A reason and valid request are required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text,0));
 SELECT * INTO prior FROM luo_workspace.operator_audit WHERE request_id=p_request;
 IF FOUND THEN
 IF prior.actor<>v_actor OR prior.action<>p_action OR prior.payload<>p_payload OR prior.reason<>p_reason THEN RAISE EXCEPTION 'Request ID reused for a different action'; END IF;
 RETURN prior.result; END IF;
 IF(SELECT count(*) FROM luo_workspace.operator_audit WHERE actor=v_actor AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Operator rate limit reached'; END IF;
 SELECT * INTO settings FROM luo_workspace.operator_settings WHERE singleton FOR UPDATE;
 IF p_action IN ('hold','approve','feature','queue_release') AND (p_payload->>'revision')::bigint IS DISTINCT FROM settings.revision THEN RAISE EXCEPTION 'Controls changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF p_action='hold' THEN
 IF jsonb_typeof(p_payload->'enabled')<>'boolean' THEN RAISE EXCEPTION 'Boolean required'; END IF;
 UPDATE luo_workspace.operator_settings SET deployment_hold=(p_payload->>'enabled')::boolean,revision=revision+1,updated_at=now();
 ELSIF p_action='approve' THEN
 IF coalesce(p_payload->>'commit','') !~ '^[a-f0-9]{40}$' THEN RAISE EXCEPTION 'A full Git commit SHA is required'; END IF;
 UPDATE luo_workspace.operator_settings SET approved_commit=p_payload->>'commit',revision=revision+1,updated_at=now();
 ELSIF p_action='feature' THEN
 IF NOT settings.flags ? coalesce(p_payload->>'name','') OR jsonb_typeof(p_payload->'enabled')<>'boolean' THEN RAISE EXCEPTION 'Unsupported feature'; END IF;
 UPDATE luo_workspace.operator_settings SET flags=jsonb_set(flags,ARRAY[p_payload->>'name'],p_payload->'enabled'),revision=revision+1,updated_at=now();
 ELSIF p_action='queue_release' THEN
 IF settings.deployment_hold THEN RAISE EXCEPTION 'Release is on hold'; END IF;
 -- Records the exact approved release for the scheduled provider retry; never pretends it deployed.
 IF p_payload->>'commit' IS DISTINCT FROM settings.approved_commit THEN RAISE EXCEPTION 'Release approval mismatch'; END IF;
 ELSIF p_action IN ('suspend_account','activate_account') THEN
 target:=(p_payload->>'user_id')::uuid;
 IF target IS NULL OR EXISTS(SELECT 1 FROM luo_workspace.admin_users WHERE user_id=target) THEN RAISE EXCEPTION 'Owner accounts are protected'; END IF;
 SELECT banned_until INTO original_ban FROM auth.users WHERE id=target AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 SELECT * INTO old_control FROM luo_workspace.account_controls WHERE user_id=target;
 IF p_action='suspend_account' THEN
 our_ban:=now()+interval '100 years';
 IF old_control.suspended AND original_ban IS NOT DISTINCT FROM old_control.applied_ban THEN original_ban:=old_control.previous_ban; END IF;
 UPDATE auth.users SET banned_until=greatest(our_ban,banned_until),updated_at=now() WHERE id=target RETURNING banned_until INTO our_ban;
 INSERT INTO luo_workspace.account_controls VALUES(target,true,original_ban,our_ban,p_reason,v_actor,now())
 ON CONFLICT(user_id) DO UPDATE SET suspended=true,previous_ban=excluded.previous_ban,applied_ban=excluded.applied_ban,reason=excluded.reason,actor=excluded.actor,updated_at=now();
 UPDATE luo_billing.agent_api_keys SET revoked_at=coalesce(revoked_at,now()) WHERE agent_id IN(SELECT id FROM luo_billing.agent_accounts WHERE auth_user_id=target);
 UPDATE luo_billing.agent_session_leases SET expires_at=now() WHERE agent_id IN(SELECT id FROM luo_billing.agent_accounts WHERE auth_user_id=target);
 ELSE
 IF NOT coalesce(old_control.suspended,false) THEN RAISE EXCEPTION 'Account has no Workspace suspension'; END IF;
 UPDATE auth.users SET banned_until=old_control.previous_ban,updated_at=now() WHERE id=target AND banned_until IS NOT DISTINCT FROM old_control.applied_ban;
 UPDATE luo_workspace.account_controls SET suspended=false,reason=p_reason,actor=v_actor,updated_at=now() WHERE user_id=target;
 -- Never grant paid time, resurrect revoked keys or change PayPal subscription state.
 END IF;
 ELSE RAISE EXCEPTION 'Unsupported control action' USING ERRCODE='22023'; END IF;
 result:=jsonb_build_object('ok',true,'action',p_action,'request_id',p_request,'state',CASE WHEN p_action='queue_release' THEN 'queued_for_scheduled_retry' ELSE 'saved' END);
 INSERT INTO luo_workspace.operator_audit VALUES(p_request,v_actor,p_action,p_payload,p_reason,result,now());
 RETURN result;
END $$;
COMMIT;
