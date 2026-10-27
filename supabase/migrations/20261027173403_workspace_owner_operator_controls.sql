BEGIN;
CREATE TABLE luo_workspace.operator_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), revision bigint NOT NULL DEFAULT 1,
 deployment_hold boolean NOT NULL DEFAULT false,
 approved_commit text NOT NULL DEFAULT '03493593ec244a34b414a15cb2b087bf7e636cbe' CHECK(approved_commit ~ '^[a-f0-9]{40}$'),
 approved_branch text NOT NULL DEFAULT 'release/payments-secondary-complete-20261027',
 not_before timestamptz NOT NULL DEFAULT '2026-10-28T17:03:53Z',
 flags jsonb NOT NULL DEFAULT '{"registration":true,"checkout":true,"paid_api":true,"posts":true,"chat":true}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO luo_workspace.operator_settings DEFAULT VALUES;
CREATE TABLE luo_workspace.account_controls (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 suspended boolean NOT NULL, previous_ban timestamptz, applied_ban timestamptz,
 reason text NOT NULL, actor uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE luo_workspace.operator_audit (
 request_id uuid PRIMARY KEY, actor uuid NOT NULL, action text NOT NULL, payload jsonb NOT NULL,
 reason text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON luo_workspace.operator_audit(created_at DESC);
CREATE TABLE luo_workspace.cash_ledger (
 transaction_id text PRIMARY KEY CHECK(length(transaction_id) BETWEEN 3 AND 128),
 subscription_id text NOT NULL, gross_minor bigint NOT NULL CHECK(gross_minor>0),
 fee_minor bigint CHECK(fee_minor>=0), net_minor bigint, currency text NOT NULL CHECK(currency='USD'),
 paid_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(fee_minor IS NULL OR net_minor=gross_minor-fee_minor)
);
ALTER TABLE luo_workspace.operator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE luo_workspace.account_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE luo_workspace.operator_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE luo_workspace.cash_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA luo_workspace FROM PUBLIC,anon,authenticated;

CREATE FUNCTION luo_workspace.require_owner() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM luo_workspace.admin_users WHERE user_id=auth.uid()) THEN
 RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
 RETURN auth.uid();
END $$;
REVOKE ALL ON FUNCTION luo_workspace.require_owner() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION luo_workspace.subject_active(subject uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=subject AND u.deleted_at IS NULL
 AND (u.banned_until IS NULL OR u.banned_until<=now())
 AND NOT EXISTS(SELECT 1 FROM luo_workspace.account_controls c WHERE c.user_id=u.id AND c.suspended))
$$;
REVOKE ALL ON FUNCTION luo_workspace.subject_active(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.luo_workspace_account_is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT luo_workspace.subject_active(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.luo_workspace_account_is_active() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.luo_workspace_account_is_active() TO authenticated;
-- Restrictive policies preserve existing permissive policies and service-role bypass.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND c.relrowsecurity AND (n.nspname='public' OR(n.nspname='storage' AND c.relname='objects')) LOOP
 EXECUTE format('CREATE POLICY luo_operator_account_active ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.luo_workspace_account_is_active())) WITH CHECK ((select public.luo_workspace_account_is_active()))',r.nspname,r.relname);
 END LOOP;
END $$;
-- Preserve the function OID used by existing billing functions.
CREATE OR REPLACE FUNCTION public.luo_agent_has_active_entitlement(p_agent uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM luo_billing.agent_accounts a JOIN luo_billing.billing_subscriptions s ON s.agent_id=a.id
 WHERE a.id=p_agent AND a.state='active' AND s.status='active' AND s.paid_through>now()
 AND luo_workspace.subject_active(a.auth_user_id))
$$;
CREATE OR REPLACE FUNCTION public.luo_agent_resolve_api_key(p_hash bytea,p_scope text)
RETURNS TABLE(agent_id uuid,plan text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT k.agent_id,s.plan FROM luo_billing.agent_api_keys k
 JOIN luo_billing.agent_session_leases l ON l.agent_id=k.agent_id AND l.generation=k.session_generation
 JOIN luo_billing.agent_accounts a ON a.id=k.agent_id JOIN luo_billing.billing_subscriptions s ON s.agent_id=k.agent_id
 WHERE k.token_hash=p_hash AND k.revoked_at IS NULL AND k.expires_at>now() AND l.expires_at>now() AND p_scope=any(k.scopes)
 AND a.state='active' AND s.status='active' AND s.paid_through>now() AND luo_workspace.subject_active(a.auth_user_id)
 ORDER BY s.provider_synced_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.luo_agent_resolve_api_key(bytea,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.luo_agent_resolve_api_key(bytea,text) TO service_role;
CREATE FUNCTION public.luo_workspace_check_access() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT luo_workspace.subject_active(auth.uid()) THEN
 RAISE EXCEPTION 'Account access suspended' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.luo_workspace_check_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.luo_workspace_check_access() TO anon,authenticated,service_role;
-- Managed roles cannot be modified through this provider. Guard each existing
-- authenticated SECURITY DEFINER entry point, preserving OIDs and grants.
-- Private backups make this cross-cutting change reviewable and reversible.
CREATE TABLE luo_workspace.access_guard_originals(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE luo_workspace.access_guard_originals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON luo_workspace.access_guard_originals FROM PUBLIC,anon,authenticated;
DO $guard$ DECLARE r record; source text; definition text; guarded text;
BEGIN
 FOR r IN SELECT p.oid,p.oid::regprocedure::text signature,p.prosrc,l.lanname,pg_get_functiondef(p.oid) definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'execute')
 AND p.proname NOT LIKE 'luo_workspace_%' AND p.proname NOT LIKE 'luo_agent_%' LOOP
 source:=r.prosrc;definition:=r.definition;
 IF r.lanname='plpgsql' THEN
  IF source !~* '\mBEGIN\M' THEN RAISE EXCEPTION 'Unsupported routine %',r.signature; END IF;
  guarded:=regexp_replace(source,'\mBEGIN\M',E'BEGIN\n PERFORM public.luo_workspace_check_access();','i');
 ELSIF r.lanname='sql' THEN
  IF source !~* '^[[:space:]]*select\M' THEN RAISE EXCEPTION 'Unsupported SQL routine %',r.signature; END IF;
  source:=regexp_replace(source,';[[:space:]]*$','');
  guarded:='WITH luo_access_guard AS MATERIALIZED (SELECT public.luo_workspace_check_access()) SELECT q.* FROM luo_access_guard CROSS JOIN LATERAL ('||source||') q';
 ELSE RAISE EXCEPTION 'Unsupported routine language %',r.signature;
 END IF;
 INSERT INTO luo_workspace.access_guard_originals VALUES(r.signature,definition);
 EXECUTE replace(definition,r.prosrc,guarded);
 END LOOP;
END $guard$;

CREATE FUNCTION public.luo_workspace_directory(p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 PERFORM luo_workspace.require_owner();
 IF length(p_search)>100 OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Invalid directory query'; END IF;
 SELECT jsonb_build_object('total',count(*),'accounts',coalesce((SELECT jsonb_agg(row_to_json(q)) FROM (
 SELECT u.id,u.email,u.created_at,u.last_sign_in_at,u.banned_until,p.username,
 coalesce(u.raw_app_meta_data->>'luo_identity_type','human') kind,
 EXISTS(SELECT 1 FROM luo_workspace.admin_users a WHERE a.user_id=u.id) protected_owner,
 coalesce(c.suspended,false) suspended,c.reason
 FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id LEFT JOIN luo_workspace.account_controls c ON c.user_id=u.id
 WHERE position(lower(coalesce(p_search,'')) in lower(coalesce(u.email,'')||' '||coalesce(p.username,'')||' '||u.id::text))>0
 ORDER BY u.created_at DESC,u.id LIMIT 25 OFFSET p_offset) q),'[]'::jsonb)) INTO result
 FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
 WHERE position(lower(coalesce(p_search,'')) in lower(coalesce(u.email,'')||' '||coalesce(p.username,'')||' '||u.id::text))>0;
 RETURN result;
END $$;
CREATE FUNCTION public.luo_workspace_control_snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 PERFORM luo_workspace.require_owner();
 SELECT jsonb_build_object('settings',to_jsonb(s),'as_of',now(),
 'audit',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT a.request_id,a.action,a.payload,a.reason,a.result,a.created_at FROM luo_workspace.operator_audit a ORDER BY a.created_at DESC LIMIT 50) q),'[]'::jsonb),
 'finance',jsonb_build_object('currency','USD','ledger_started_at',(SELECT min(recorded_at) FROM luo_workspace.cash_ledger),
 'completed_count',(SELECT count(*) FROM luo_workspace.cash_ledger),
 'gross_minor',(SELECT coalesce(sum(gross_minor),0) FROM luo_workspace.cash_ledger),
 'fees_minor',(SELECT CASE WHEN count(*)=count(fee_minor) THEN sum(fee_minor) END FROM luo_workspace.cash_ledger),
 'net_minor',(SELECT CASE WHEN count(*)=count(net_minor) THEN sum(net_minor) END FROM luo_workspace.cash_ledger),
 'unreconciled_refunds',(SELECT count(*) FROM luo_billing.payment_events WHERE event_type IN ('PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED')),
 'active_paid_subscriptions',(SELECT count(*) FROM luo_billing.billing_subscriptions WHERE status='active' AND paid_through>now()),
 'forecast_mrr_minor',(SELECT coalesce(sum(CASE plan WHEN 'starter' THEN 1200 WHEN 'pro' THEN 2400 WHEN 'max' THEN 3000 ELSE 0 END),0) FROM luo_billing.billing_subscriptions WHERE status='active' AND paid_through>now()),
 'plan_mix',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM(SELECT plan,count(*) count FROM luo_billing.billing_subscriptions WHERE status='active' AND paid_through>now() GROUP BY plan) q),'[]'::jsonb),
 'agent_accounts',(SELECT count(*) FROM luo_billing.agent_accounts),
 'suspended_accounts',(SELECT count(*) FROM luo_workspace.account_controls WHERE suspended)
 )) INTO result FROM luo_workspace.operator_settings s;
 RETURN result;
END $$;
CREATE FUNCTION public.luo_workspace_control(p_action text,p_payload jsonb,p_reason text,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 IF old_control.suspended THEN original_ban:=old_control.previous_ban; END IF;
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
CREATE FUNCTION public.luo_agent_runtime_controls() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('flags',flags,'deployment_hold',deployment_hold,'approved_commit',approved_commit,'approved_branch',approved_branch,'not_before',not_before,'revision',revision) FROM luo_workspace.operator_settings WHERE singleton
$$;
CREATE FUNCTION public.luo_agent_record_cash(p_transaction text,p_subscription text,p_gross bigint,p_fee bigint,p_net bigint,p_paid_at timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM luo_billing.billing_subscriptions WHERE provider='paypal' AND provider_subscription_id=p_subscription) THEN RAISE EXCEPTION 'Unknown subscription'; END IF;
 IF p_paid_at IS NULL OR p_paid_at>now()+interval '1 day' THEN RAISE EXCEPTION 'Invalid payment time'; END IF;
 IF EXISTS(SELECT 1 FROM luo_workspace.cash_ledger WHERE transaction_id=p_transaction AND (subscription_id<>p_subscription OR gross_minor<>p_gross OR paid_at<>p_paid_at)) THEN RAISE EXCEPTION 'Conflicting payment evidence'; END IF;
 INSERT INTO luo_workspace.cash_ledger(transaction_id,subscription_id,gross_minor,fee_minor,net_minor,currency,paid_at) VALUES(p_transaction,p_subscription,p_gross,p_fee,p_net,'USD',p_paid_at) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.luo_workspace_directory(text,integer),public.luo_workspace_control_snapshot(),public.luo_workspace_control(text,jsonb,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.luo_workspace_directory(text,integer),public.luo_workspace_control_snapshot(),public.luo_workspace_control(text,jsonb,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.luo_agent_runtime_controls(),public.luo_agent_record_cash(text,text,bigint,bigint,bigint,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.luo_agent_runtime_controls(),public.luo_agent_record_cash(text,text,bigint,bigint,bigint,timestamptz) TO service_role;
COMMIT;
