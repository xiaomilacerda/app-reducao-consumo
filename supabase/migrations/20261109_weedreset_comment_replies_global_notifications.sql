-- WeedReset notifications: preserve existing comments, add targeted replies,
-- and prevent duplicate notifications for new activity.
-- Applied to production on 2026-11-09.
ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
  REFERENCES public.community_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weedreset_comments_parent
  ON public.community_comments(parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.weedreset_validate_comment_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_post_id uuid;
  v_status text;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_comment_id = NEW.id THEN
    RAISE EXCEPTION 'Não é possível responder ao próprio registro';
  END IF;

  SELECT c.post_id, c.status INTO v_post_id, v_status
  FROM public.community_comments c
  WHERE c.id = NEW.parent_comment_id;

  IF NOT FOUND OR v_post_id IS DISTINCT FROM NEW.post_id THEN
    RAISE EXCEPTION 'O comentário de origem não pertence à publicação';
  END IF;

  IF lower(coalesce(v_status, 'active')) NOT IN ('active', 'published') THEN
    RAISE EXCEPTION 'O comentário de origem não está disponível';
  END IF;

  RETURN NEW;
END;
$function$


DROP TRIGGER IF EXISTS trg_weedreset_validate_comment_parent ON public.community_comments;
CREATE TRIGGER trg_weedreset_validate_comment_parent
BEFORE INSERT OR UPDATE OF post_id, parent_comment_id
ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.weedreset_validate_comment_parent();

-- The old pair of AFTER INSERT triggers generated two notices per comment.
DROP TRIGGER IF EXISTS trg_community_comment_notify ON public.community_comments;

CREATE OR REPLACE FUNCTION public.tg_create_community_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_recipient uuid;
  v_post_status text;
  v_parent_status text;
  v_type text;
BEGIN
  IF NEW.user_id IS NULL OR lower(coalesce(NEW.status,'active')) NOT IN ('active','published') THEN
    RETURN NEW;
  END IF;

  SELECT p.status INTO v_post_status
  FROM public.community_posts p
  WHERE p.id = NEW.post_id;

  IF NOT FOUND OR lower(coalesce(v_post_status,'active')) NOT IN ('active','published') THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT c.user_id, c.status INTO v_recipient, v_parent_status
    FROM public.community_comments c
    WHERE c.id = NEW.parent_comment_id AND c.post_id = NEW.post_id;

    IF NOT FOUND OR lower(coalesce(v_parent_status,'active')) NOT IN ('active','published') THEN
      RETURN NEW;
    END IF;

    v_type := 'reply_to_comment';
  ELSE
    SELECT p.user_id INTO v_recipient
    FROM public.community_posts p
    WHERE p.id = NEW.post_id;
    v_type := 'comment_on_post';
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.community_notifications
    (user_id, actor_id, post_id, comment_id, type)
  VALUES
    (v_recipient, NEW.user_id, NEW.post_id, NEW.id, v_type);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notification failures should not destroy the comment. Log the failure
  -- instead of silently swallowing it as in the original implementation.
  RAISE WARNING 'weedreset_community_notification_failed: %', SQLERRM;
  RETURN NEW;
END;
$function$


REVOKE ALL ON FUNCTION public.weedreset_validate_comment_parent()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_create_community_notification()
  FROM PUBLIC, anon, authenticated;
