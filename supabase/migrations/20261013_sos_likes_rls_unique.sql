-- 13/10/2026: isolamento de curtidas SOS no banco oficial weedreset.
-- A contagem agregada das curtidas permanece disponível na view
-- sos_likes_aggregates sem expor a identidade dos usuários.

ALTER TABLE public.sos_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sos_likes FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.sos_likes TO authenticated;

ALTER TABLE public.sos_likes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.sos_likes ALTER COLUMN sos_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sos_likes_one_vote_per_user_and_tool
  ON public.sos_likes (user_id, sos_id);

DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sos_likes' AND policyname='sos_likes_select_own') THEN
  CREATE POLICY "sos_likes_select_own" ON public.sos_likes
   FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sos_likes' AND policyname='sos_likes_insert_own') THEN
  CREATE POLICY "sos_likes_insert_own" ON public.sos_likes
   FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sos_likes' AND policyname='sos_likes_delete_own') THEN
  CREATE POLICY "sos_likes_delete_own" ON public.sos_likes
   FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
 END IF;
END $$;

COMMENT ON TABLE public.sos_likes IS 'SOS: curtidas particulares, uma por usuário por técnica; apenas total público via view';
