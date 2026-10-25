-- Luo Workspace, private owner-only dashboard. No user or billing tables are altered.
BEGIN;
CREATE SCHEMA IF NOT EXISTS luo_workspace;
REVOKE ALL ON SCHEMA luo_workspace FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS luo_workspace.admin_users (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE luo_workspace.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON luo_workspace.admin_users FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.luo_workspace_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE payload jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM luo_workspace.admin_users a WHERE a.user_id=auth.uid()
 ) THEN
  RAISE EXCEPTION 'Workspace access denied' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object(
  'as_of', now(),
  'stats', jsonb_build_object(
   'registered', (SELECT count(*) FROM auth.users),
   'profiles', (SELECT count(*) FROM public.profiles),
   'registered_24h', (SELECT count(*) FROM auth.users WHERE created_at>=now()-interval '24 hours'),
   'registered_7d', (SELECT count(*) FROM auth.users WHERE created_at>=now()-interval '7 days'),
   'signed_in_24h', (SELECT count(*) FROM auth.users WHERE last_sign_in_at>=now()-interval '24 hours'),
   'signed_in_7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at>=now()-interval '7 days'),
   'engaged_24h', (SELECT count(*) FROM (
      SELECT id FROM auth.users WHERE last_sign_in_at>=now()-interval '24 hours'
      UNION SELECT sender_id FROM public.chat_messages WHERE created_at>=now()-interval '24 hours' AND sender_id IS NOT NULL
      UNION SELECT user_id FROM public.messages WHERE created_at>=now()-interval '24 hours' AND user_id IS NOT NULL
   ) events),
   'engaged_7d', (SELECT count(*) FROM (
      SELECT id FROM auth.users WHERE last_sign_in_at>=now()-interval '7 days'
      UNION SELECT sender_id FROM public.chat_messages WHERE created_at>=now()-interval '7 days' AND sender_id IS NOT NULL
      UNION SELECT user_id FROM public.messages WHERE created_at>=now()-interval '7 days' AND user_id IS NOT NULL
   ) events),
   'chat_messages',(SELECT count(*) FROM public.chat_messages WHERE deleted_at IS NULL),
   'legacy_messages',(SELECT count(*) FROM public.messages WHERE is_deleted=false),
   'messages_24h',(SELECT count(*) FROM public.chat_messages WHERE created_at>=now()-interval '24 hours' AND deleted_at IS NULL),
   'conversations',(SELECT count(*) FROM public.conversations),
   'groups',(SELECT count(*) FROM public.conversations WHERE kind='group'),
   'stories',(SELECT count(*) FROM public.chat_stories),
   'active_stories',(SELECT count(*) FROM public.chat_stories WHERE expires_at>now()),
   'calls',(SELECT count(*) FROM public.chat_calls),
   'friends',(SELECT count(*) FROM public.friendships),
   'moderation_actions',(SELECT count(*) FROM public.moderation_logs),
   'pending_notifications',(SELECT count(*) FROM public.chat_notifications WHERE read_at IS NULL)
  ),
  'registrations', (
   SELECT coalesce(jsonb_agg(jsonb_build_object('date',to_char(day::date,'YYYY-MM-DD'),'count',cnt) ORDER BY day),'[]'::jsonb)
   FROM (
    SELECT d.day, count(u.id) cnt FROM generate_series((now() AT TIME ZONE 'UTC')::date-13,(now() AT TIME ZONE 'UTC')::date,'1 day'::interval) d(day)
    LEFT JOIN auth.users u ON u.created_at >= d.day AND u.created_at < d.day+interval '1 day'
    GROUP BY d.day
   ) summary
  ),
  'recent_accounts', (
   SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'email',u.email,'username',p.username,'display_name',p.display_name,
    'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at
   ) ORDER BY u.created_at DESC),'[]'::jsonb)
   FROM (SELECT id,email,created_at,last_sign_in_at FROM auth.users ORDER BY created_at DESC LIMIT 40) u
   LEFT JOIN public.profiles p ON p.id=u.id
  )
 ) INTO payload;
 RETURN payload;
END;
$$;
REVOKE ALL ON FUNCTION public.luo_workspace_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.luo_workspace_snapshot() TO authenticated;
COMMIT;
