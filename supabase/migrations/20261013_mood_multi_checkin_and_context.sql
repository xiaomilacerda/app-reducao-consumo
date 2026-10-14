-- WeedReset: cada check-in emocional é um evento independente.
-- Preserve integralmente os registros anteriores e o formato legado do histórico.
ALTER TABLE public.mood_entries DROP CONSTRAINT IF EXISTS mood_entries_user_date_unique;
CREATE INDEX IF NOT EXISTS mood_entries_user_date_created_idx
  ON public.mood_entries (user_id, date DESC, created_at DESC);
ALTER TABLE public.mood_entries
  ADD COLUMN IF NOT EXISTS context_tags text[] NOT NULL DEFAULT '{}'::text[];
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.mood_entries'::regclass AND conname='mood_entries_context_tags_limited') THEN
  ALTER TABLE public.mood_entries ADD CONSTRAINT mood_entries_context_tags_limited
   CHECK (cardinality(context_tags) <= 3 AND char_length(array_to_string(context_tags,' ')) <= 180);
 END IF;
END $$;
COMMENT ON COLUMN public.mood_entries.context_tags IS
  'Até três fatores opcionais auto-relatados por check-in; nunca interpretados como diagnóstico.';
