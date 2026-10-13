-- WeedReset · Perfil Evolução (13/10/2026)
-- Dados opcionais, privados por usuário e sem alterações destrutivas.
-- Aplicado no projeto weedreset: wlujqtxnlmyncdvsaumw.

CREATE TABLE IF NOT EXISTS public.profile_growth_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_kind text NOT NULL DEFAULT 'checkins'
    CHECK (goal_kind IN ('checkins','spending','sessions')),
  goal_target numeric(12,2) NOT NULL DEFAULT 3
    CHECK (goal_target > 0 AND goal_target <= 100000),
  goal_deadline date NULL,
  baseline_weekly_spend numeric(12,2) NULL
    CHECK (baseline_weekly_spend BETWEEN 0 AND 100000),
  money_currency text NOT NULL DEFAULT 'BRL'
    CHECK (money_currency IN ('BRL','USD','EUR')),
  triggers text[] NOT NULL DEFAULT '{}'::text[],
  coping_actions text[] NOT NULL DEFAULT '{}'::text[],
  support_label text NULL CHECK (char_length(support_label) <= 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_growth_triggers_limit CHECK (
    cardinality(triggers) <= 3 AND
    array_to_string(triggers,'') IS NOT NULL AND
    char_length(array_to_string(triggers,' ')) <= 300
  ),
  CONSTRAINT profile_growth_coping_limit CHECK (
    cardinality(coping_actions) <= 3 AND
    array_to_string(coping_actions,'') IS NOT NULL AND
    char_length(array_to_string(coping_actions,' ')) <= 450
  ),
  CONSTRAINT profile_growth_target_kind CHECK (
    (goal_kind='checkins' AND goal_target=trunc(goal_target) AND goal_target BETWEEN 1 AND 7)
    OR (goal_kind='sessions' AND goal_target=trunc(goal_target) AND goal_target BETWEEN 1 AND 100)
    OR (goal_kind='spending' AND goal_target BETWEEN 1 AND 100000)
  )
);
CREATE TABLE IF NOT EXISTS public.profile_weekly_reviews (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (extract(isodow from week_start)=1),
  sessions integer NULL CHECK (sessions BETWEEN 0 AND 500),
  spent numeric(12,2) NULL CHECK (spent BETWEEN 0 AND 100000),
  mood text NULL CHECK (mood IN ('bem','normal','dificil')),
  money_currency text NOT NULL DEFAULT 'BRL'
    CHECK (money_currency IN ('BRL','USD','EUR')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,week_start)
);

ALTER TABLE public.profile_growth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_weekly_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_growth_settings,public.profile_weekly_reviews FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profile_growth_settings,public.profile_weekly_reviews TO authenticated;

DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_growth_settings' AND policyname='Growth settings own select') THEN
  CREATE POLICY "Growth settings own select" ON public.profile_growth_settings FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
  CREATE POLICY "Growth settings own insert" ON public.profile_growth_settings FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
  CREATE POLICY "Growth settings own update" ON public.profile_growth_settings FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
  CREATE POLICY "Growth settings own delete" ON public.profile_growth_settings FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_weekly_reviews' AND policyname='Weekly reviews own select') THEN
  CREATE POLICY "Weekly reviews own select" ON public.profile_weekly_reviews FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
  CREATE POLICY "Weekly reviews own insert" ON public.profile_weekly_reviews FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
  CREATE POLICY "Weekly reviews own update" ON public.profile_weekly_reviews FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
  CREATE POLICY "Weekly reviews own delete" ON public.profile_weekly_reviews FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
 END IF;
END $$;

COMMENT ON TABLE public.profile_growth_settings IS 'Metas e plano de apoio privados do usuário';
COMMENT ON TABLE public.profile_weekly_reviews IS 'Registros semanais voluntários; ausência não equivale a zero';
