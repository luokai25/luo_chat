-- Luo Workspace additive v2 insights: no changes to existing chat/account/payment tables.
BEGIN;
CREATE TABLE IF NOT EXISTS luo_workspace.connector_snapshots (
 provider text PRIMARY KEY CHECK (provider IN ('paypal','vercel','github','resend','cloudflare')),
 collected_at timestamptz NOT NULL DEFAULT now(),
 source_window text NOT NULL,
 scope_label text NOT NULL,
 summary jsonb NOT NULL CHECK (jsonb_typeof(summary)='object')
);
ALTER TABLE luo_workspace.connector_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON luo_workspace.connector_snapshots FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.luo_workspace_insights()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE output jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS
 (SELECT 1 FROM luo_workspace.admin_users a WHERE a.user_id=auth.uid())
 THEN RAISE EXCEPTION 'Workspace access denied' USING ERRCODE='42501';END IF;

 SELECT jsonb_build_object(
   'collected_at',now(),
   'account_summary',jsonb_build_object(
     'total',(SELECT count(*) FROM auth.users),
     'with_profile',(SELECT count(*) FROM public.profiles),
     'never_signed_in',(SELECT count(*) FROM auth.users WHERE last_sign_in_at IS NULL),
     'last_signed_in_24h',(SELECT count(*) FROM auth.users WHERE last_sign_in_at>=now()-interval '24 hours'),
     'last_signed_in_7d',(SELECT count(*) FROM auth.users WHERE last_sign_in_at>=now()-interval '7 days'),
     'last_signed_in_30d',(SELECT count(*) FROM auth.users WHERE last_sign_in_at>=now()-interval '30 days'),
     'joined_today_utc',(SELECT count(*) FROM auth.users WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
     'joined_7d',(SELECT count(*) FROM auth.users WHERE created_at>=now()-interval '7 days'),
     'joined_30d',(SELECT count(*) FROM auth.users WHERE created_at>=now()-interval '30 days')
   ),
   'social_summary',jsonb_build_object(
     'messages_7d',(SELECT count(*) FROM public.chat_messages WHERE created_at>=now()-interval '7 days' AND deleted_at IS NULL),
     'messages_30d',(SELECT count(*) FROM public.chat_messages WHERE created_at>=now()-interval '30 days' AND deleted_at IS NULL),
     'distinct_senders_7d',(SELECT count(DISTINCT sender_id) FROM public.chat_messages WHERE created_at>=now()-interval '7 days' AND deleted_at IS NULL),
     'conversations_7d',(SELECT count(*) FROM public.conversations WHERE created_at>=now()-interval '7 days'),
     'stories_7d',(SELECT count(*) FROM public.chat_stories WHERE created_at>=now()-interval '7 days'),
     'calls_7d',(SELECT count(*) FROM public.chat_calls WHERE created_at>=now()-interval '7 days'),
     'pending_contacts',(SELECT count(*) FROM public.chat_connections WHERE state='pending'),
     'accepted_contacts',(SELECT count(*) FROM public.chat_connections WHERE state='accepted'),
     'open_deletion_requests',(SELECT count(*) FROM public.account_deletion_requests WHERE status='pending')
   ),
   'daily_30d',(
     SELECT coalesce(jsonb_agg(jsonb_build_object(
        'date',to_char(d.day,'YYYY-MM-DD'),
        'signups',coalesce(r.n,0),
        'messages',coalesce(m.n,0),
        'stories',coalesce(s.n,0),
        'last_signed_in',coalesce(u.n,0)
       ) ORDER BY d.day),'[]'::jsonb)
     FROM generate_series(
       (now() AT TIME ZONE 'UTC')::date-29,
       (now() AT TIME ZONE 'UTC')::date,
       '1 day'::interval
     ) AS d(day)
     LEFT JOIN (SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*) AS n FROM auth.users
       WHERE created_at>=now()-interval '32 days' GROUP BY 1) r ON r.day=d.day
     LEFT JOIN (SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*) AS n FROM public.chat_messages
       WHERE created_at>=now()-interval '32 days' AND deleted_at IS NULL GROUP BY 1) m ON m.day=d.day
     LEFT JOIN (SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*) AS n FROM public.chat_stories
       WHERE created_at>=now()-interval '32 days' GROUP BY 1) s ON s.day=d.day
     LEFT JOIN (SELECT (last_sign_in_at AT TIME ZONE 'UTC')::date AS day,count(*) AS n FROM auth.users
       WHERE last_sign_in_at>=now()-interval '32 days' GROUP BY 1) u ON u.day=d.day
   ),
   'connectors',(
     SELECT coalesce(jsonb_object_agg(c.provider,jsonb_build_object(
       'collected_at',c.collected_at,
       'source_window',c.source_window,
       'scope_label',c.scope_label,
       'summary',c.summary
     )),'{}'::jsonb)
     FROM luo_workspace.connector_snapshots c
   )
 ) INTO output;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.luo_workspace_insights() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.luo_workspace_insights() TO authenticated;
COMMIT;
