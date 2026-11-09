-- Applied in Supabase production on 2026-11-09; retained for version control.

-- WeedReset: access controls and atomic avatar purchases (2026-11-09).
-- This migration changes permissions; it does not remove or overwrite user records.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_logs','admin_users','analytics_daily','analytics_events','app_settings',
    'evolution_timeline','missions_triggers','mood_entries_backup_20251127',
    'mood_entries_backup_20251127_155716','notification_queue',
    'notification_templates','profiles_backup','user_level_legacy'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Only general catalogs may be directly read by signed-in app users.
GRANT SELECT ON public.evolution_timeline, public.missions_triggers, public.notification_templates TO authenticated;
CREATE POLICY weedreset_evolution_catalog_read ON public.evolution_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY weedreset_mission_triggers_read ON public.missions_triggers FOR SELECT TO authenticated USING (true);
CREATE POLICY weedreset_notification_templates_read ON public.notification_templates FOR SELECT TO authenticated USING (true);

-- Run all existing views with the caller's RLS restrictions.
ALTER VIEW public.daily_missions_catalog SET (security_invoker = true);
ALTER VIEW public.sos_likes_aggregates SET (security_invoker = true);
ALTER VIEW public.sos_usage_aggregates SET (security_invoker = true);
ALTER VIEW public.sos_usage_daily SET (security_invoker = true);

-- Administrative check cannot be modified through a user's normal profile edit.
CREATE OR REPLACE FUNCTION public.weedreset_is_current_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid()) AND p.is_admin IS TRUE
 );
$$;
REVOKE ALL ON FUNCTION public.weedreset_is_current_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weedreset_is_current_admin() TO authenticated;

-- Profiles are readable by their owner, or a privileged moderator; not the open internet.
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
CREATE POLICY weedreset_profiles_admin_read ON public.profiles
 FOR SELECT TO authenticated USING ((select public.weedreset_is_current_admin()));
REVOKE SELECT ON public.profiles FROM anon;

-- Client code cannot edit role, admin, premium, XP, coin balances or moderation privileges.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  full_name, display_name, email, thc_potency, main_goal, timezone, updated_at,
  frequency_tag, daily_cost, last_use, wants_reminders, grams_per_joint,
  currency, journey_start_date, preferred_language, equipped_icon_item_id,
  equipped_icon, equipped_avatar, equipped_card, equipped_frame, equipped_theme,
  frequency_amount, frequency_period, price_per_gram, consumption_methods,
  last_use_datetime, theme, theme_mode
) ON public.profiles TO authenticated;

-- Even new profile inserts cannot grant oneself paid or administrative privileges.
CREATE POLICY weedreset_profiles_insert_guard ON public.profiles
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (
  (select auth.uid()) = id
  AND is_admin IS FALSE AND is_premium IS FALSE
  AND (role IS NULL OR role = 'user')
  AND coalesce(coins,0)=0 AND coalesce(xp,0)=0
  AND coalesce(can_comment,true) IS TRUE
  AND coalesce(can_report,true) IS TRUE
  AND comment_blocked_until IS NULL AND report_blocked_until IS NULL
 );

-- Public wall content: only published content, the owner and moderators can read.
DROP POLICY IF EXISTS "Todos podem ver posts" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts select" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts delete" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts update" ON public.community_posts;
DROP POLICY IF EXISTS "Usuário pode curtir posts" ON public.community_posts;
CREATE POLICY weedreset_posts_public_read ON public.community_posts
 FOR SELECT TO anon USING (status IS NULL OR status IN ('active','published'));
CREATE POLICY weedreset_posts_member_read ON public.community_posts
 FOR SELECT TO authenticated USING (
  status IS NULL OR status IN ('active','published')
  OR (select auth.uid()) = user_id OR (select public.weedreset_is_current_admin())
 );
CREATE POLICY weedreset_posts_owner_delete ON public.community_posts
 FOR DELETE TO authenticated USING ((select auth.uid()) = user_id OR (select public.weedreset_is_current_admin()));
CREATE POLICY weedreset_posts_owner_update ON public.community_posts
 FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
 WITH CHECK ((select auth.uid()) = user_id);
REVOKE UPDATE ON public.community_posts FROM PUBLIC, anon, authenticated;
GRANT UPDATE(content) ON public.community_posts TO authenticated;
CREATE POLICY weedreset_posts_insert_guard ON public.community_posts
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (
  user_id = (select auth.uid()) AND coalesce(is_premium_post,false) IS TRUE
  AND status IN ('active','published') AND coalesce(likes,0)=0
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=(select auth.uid()) AND p.is_premium IS TRUE)
 );

DROP POLICY IF EXISTS "Public read comments" ON public.community_comments;
DROP POLICY IF EXISTS "Todos podem ver comentários" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments select" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments delete" ON public.community_comments;
CREATE POLICY weedreset_comments_public_read ON public.community_comments
 FOR SELECT TO anon USING (status IS NULL OR status IN ('active','published'));
CREATE POLICY weedreset_comments_member_read ON public.community_comments
 FOR SELECT TO authenticated USING (
  status IS NULL OR status IN ('active','published')
  OR (select auth.uid()) = user_id OR (select public.weedreset_is_current_admin())
 );
CREATE POLICY weedreset_comments_owner_delete ON public.community_comments
 FOR DELETE TO authenticated USING ((select auth.uid()) = user_id OR (select public.weedreset_is_current_admin()));
REVOKE UPDATE ON public.community_comments FROM PUBLIC, anon, authenticated;
GRANT UPDATE(content) ON public.community_comments TO authenticated;
CREATE POLICY weedreset_comments_insert_guard ON public.community_comments
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (
   user_id=(select auth.uid())
   AND EXISTS(SELECT 1 FROM public.profiles p
      WHERE p.id=(select auth.uid()) AND p.is_premium IS TRUE
       AND p.can_comment IS DISTINCT FROM false
       AND (p.comment_blocked_until IS NULL OR p.comment_blocked_until < now()))
 );

-- Reports contain sensitive reporter and target information. Never expose all reports.
DROP POLICY IF EXISTS "community_reports select" ON public.community_reports;
DROP POLICY IF EXISTS "community_reports delete" ON public.community_reports;
CREATE POLICY weedreset_reports_owner_admin_read ON public.community_reports
 FOR SELECT TO authenticated
 USING ((select auth.uid()) = user_id OR (select public.weedreset_is_current_admin()));
CREATE POLICY weedreset_reports_insert_guard ON public.community_reports
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (
   user_id=(select auth.uid())
   AND EXISTS(SELECT 1 FROM public.profiles p
     WHERE p.id=(select auth.uid()) AND p.can_report IS DISTINCT FROM false
       AND (p.report_blocked_until IS NULL OR p.report_blocked_until < now()))
 );
REVOKE DELETE, UPDATE ON public.community_reports FROM PUBLIC, anon, authenticated;

-- Prevent free editing of currency balances and free granting of paid avatars.
REVOKE UPDATE, DELETE ON public.user_wallet FROM PUBLIC, anon, authenticated;
CREATE POLICY weedreset_wallet_insert_guard ON public.user_wallet
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (
  user_id=(select auth.uid()) AND coalesce(coins,0) BETWEEN 0 AND 200
  AND coalesce(balance,0)=0
 );
REVOKE DELETE ON public.user_store_items FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON public.user_store_items FROM PUBLIC, anon, authenticated;
GRANT UPDATE(equipped) ON public.user_store_items TO authenticated;
CREATE POLICY weedreset_free_avatar_insert_guard ON public.user_store_items
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (user_id=(select auth.uid()) AND item_id='avatar_A1');

-- Confirm payment and inventory in a single server-side transaction.
CREATE OR REPLACE FUNCTION public.purchase_avatar_secure(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 u uuid := auth.uid();
 code text := upper(btrim(coalesce(p_code,'')));
 price integer;
 current_coins integer;
BEGIN
 IF u IS NULL OR (auth.jwt()->>'is_anonymous')='true' THEN
  RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501';
 END IF;
 IF code !~ '^A([1-9]|1[0-9]|20)$' THEN
  RAISE EXCEPTION 'Avatar inválido.' USING ERRCODE='22023';
 END IF;
 price := CASE code
   WHEN 'A1' THEN 0 WHEN 'A2' THEN 50 WHEN 'A3' THEN 100
   WHEN 'A4' THEN 150 WHEN 'A5' THEN 250 WHEN 'A6' THEN 350
   WHEN 'A7' THEN 500 WHEN 'A8' THEN 700 WHEN 'A9' THEN 900
   WHEN 'A10' THEN 1200 WHEN 'A11' THEN 1500 WHEN 'A12' THEN 1800
   WHEN 'A13' THEN 2200 WHEN 'A14' THEN 2600 WHEN 'A15' THEN 3000
   WHEN 'A16' THEN 3500 WHEN 'A17' THEN 4000 WHEN 'A18' THEN 4600
   WHEN 'A19' THEN 5200 WHEN 'A20' THEN 6000
 END;
 -- Serializes simultaneous purchases for the same user, across sessions.
 PERFORM 1 FROM auth.users WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.user_wallet(user_id,coins,balance)
 VALUES (u,200,0) ON CONFLICT (user_id) DO NOTHING;
 SELECT coins INTO current_coins FROM public.user_wallet WHERE user_id=u FOR UPDATE;
 IF current_coins IS NULL THEN
   RAISE EXCEPTION 'Carteira indisponível.' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.user_store_items WHERE user_id=u AND item_id='avatar_'||code) THEN
   RETURN jsonb_build_object('ok',true,'already_owned',true,'coins',current_coins);
 END IF;
 IF current_coins < price THEN
  RAISE EXCEPTION 'Moedas insuficientes.' USING ERRCODE='23514';
 END IF;
 UPDATE public.user_wallet SET coins=coins-price,updated_at=now()
  WHERE user_id=u RETURNING coins INTO current_coins;
 INSERT INTO public.user_store_items(user_id,item_id,equipped)
 VALUES(u,'avatar_'||code,false);
 RETURN jsonb_build_object('ok',true,'coins',current_coins,'already_owned',false);
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_avatar_secure(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_avatar_secure(text) TO authenticated;
