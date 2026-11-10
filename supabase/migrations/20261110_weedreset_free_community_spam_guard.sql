-- WeedReset: launch-ready free community. No payment or Premium entitlement
-- required to post/reply. Auth, moderation and anti-spam are enforced in DB.
-- Existing data is never rewritten or deleted.

CREATE OR REPLACE FUNCTION public.weedreset_guard_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o titular pode publicar.' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(NEW.content, ''))) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'A publicação deve ter entre 3 e 2000 caracteres.' USING ERRCODE='22023';
  END IF;
  -- Serialize concurrent attempts per user to enforce 1 post / rolling 24h.
  NEW.created_at := now();
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wr-post:' || NEW.user_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.community_posts AS existing
    WHERE existing.user_id = NEW.user_id
      AND existing.created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'Você já publicou nas últimas 24 horas.' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_weedreset_community_post_rate ON public.community_posts;
CREATE TRIGGER trg_weedreset_community_post_rate
BEFORE INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.weedreset_guard_community_post();

CREATE OR REPLACE FUNCTION public.weedreset_guard_community_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Apenas o titular pode responder.' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(NEW.content, ''))) NOT BETWEEN 1 AND 800 THEN
    RAISE EXCEPTION 'A resposta deve ter entre 1 e 800 caracteres.' USING ERRCODE='22023';
  END IF;
  NEW.created_at := now();
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wr-comment:' || NEW.user_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.community_comments AS existing
    WHERE existing.user_id = NEW.user_id
      AND existing.created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'Espere 30 segundos antes de enviar outra resposta.' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_weedreset_community_comment_rate ON public.community_comments;
CREATE TRIGGER trg_weedreset_community_comment_rate
BEFORE INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.weedreset_guard_community_comment();

DROP POLICY IF EXISTS weedreset_posts_insert_guard ON public.community_posts;
CREATE POLICY weedreset_posts_insert_guard ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' AND
    status IN ('active','published') AND
    coalesce(likes,0)=0 AND
    moderated_by IS NULL AND moderated_at IS NULL AND
    length(btrim(coalesce(content,''))) BETWEEN 3 AND 2000 AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.can_comment IS DISTINCT FROM false
        AND (p.comment_blocked_until IS NULL OR p.comment_blocked_until < now())
        AND (coalesce(is_premium_post,false) IS NOT TRUE OR p.is_premium IS TRUE)
    )
  );

DROP POLICY IF EXISTS weedreset_comments_insert_guard ON public.community_comments;
CREATE POLICY weedreset_comments_insert_guard ON public.community_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' AND
    moderated_by IS NULL AND moderated_at IS NULL AND
    length(btrim(content)) BETWEEN 1 AND 800 AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.can_comment IS DISTINCT FROM false
        AND (p.comment_blocked_until IS NULL OR p.comment_blocked_until < now())
    )
  );

REVOKE ALL ON FUNCTION public.weedreset_guard_community_post() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weedreset_guard_community_comment() FROM PUBLIC, anon, authenticated;
