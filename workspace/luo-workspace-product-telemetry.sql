-- Luo Workspace expansion: privacy-preserving aggregates, no message contents.
-- Owner-only, deny anonymous, never grants access to underlying tables.
CREATE OR REPLACE FUNCTION public.luo_workspace_product_insights()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF (select auth.uid()) IS NULL OR NOT EXISTS
   (SELECT 1 FROM luo_workspace.admin_users a WHERE a.user_id=(select auth.uid()))
 THEN RAISE EXCEPTION 'Workspace access denied' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object(
  'collected_at',now(),
  'source','production database · owner only',
  'worlds',jsonb_build_object(
    'published',(SELECT count(*) FROM luo_internal.space_entries e WHERE e.kind='community' AND e.published),
    'created_7d',(SELECT count(*) FROM luo_internal.space_entries e WHERE e.kind='community' AND e.published AND e.created_at>=now()-interval '7 days'),
    'channels',NULL
  ),
  'messaging',jsonb_build_object(
    'direct_threads',(SELECT count(*) FROM public.conversations WHERE kind='direct'),
    'group_threads',(SELECT count(*) FROM public.conversations WHERE kind='group'),
    'shared_references_7d',(SELECT count(*) FROM public.chat_messages WHERE created_at>=now()-interval '7 days'
      AND deleted_at IS NULL AND recalled_at IS NULL AND (body LIKE 'Luo Clip%' OR body LIKE 'Luo Post%'))
  ),
  'luonix',jsonb_build_object(
    'videos',(SELECT count(*) FROM luo_internal.space_entries WHERE kind='clip' AND published),
    'photos',(SELECT count(*) FROM luo_internal.space_entries WHERE kind='post' AND published AND jsonb_array_length(media)>0),
    'written_posts',(SELECT count(*) FROM luo_internal.space_entries WHERE kind='post' AND published AND jsonb_array_length(media)=0),
    'published_7d',(SELECT count(*) FROM luo_internal.space_entries WHERE kind IN ('post','clip') AND published AND created_at>=now()-interval '7 days')
  ),
  'agents',jsonb_build_object('registrations',NULL,'active_subscriptions',NULL,'billing','not_live','reason','Agent entitlement ledger is not activated; do not infer accounts from human signup')
 );
END;$$;
REVOKE ALL ON FUNCTION public.luo_workspace_product_insights() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.luo_workspace_product_insights() TO authenticated;
COMMENT ON FUNCTION public.luo_workspace_product_insights() IS 'Owner-only Luo messaging, Luonix and Worlds aggregate metrics. No private content.';
