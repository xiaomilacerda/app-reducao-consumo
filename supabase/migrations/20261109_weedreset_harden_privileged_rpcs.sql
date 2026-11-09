-- Applied to Supabase production 2026-11-09.

-- Block unauthenticated execution of privileged routines and retire unsafe legacy RPCs.
DO $$
DECLARE f record;
BEGIN
 FOR f IN
  SELECT p.oid::regprocedure::text AS signature
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $$;

-- These old SECURITY DEFINER functions accept arbitrary user IDs or reward amounts.
-- Only trusted server-side functions may call them.
DO $$
DECLARE f record;
BEGIN
 FOR f IN
  SELECT p.oid::regprocedure::text AS signature
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND p.proname IN (
       '_ensure_user_core','grant_reward','complete_journey_mission',
       'buy_item','apply_item','handle_new_user',
       'tg_create_comment_notification','tg_create_community_notification'
    )
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated',f.signature);
 END LOOP;
END $$;
