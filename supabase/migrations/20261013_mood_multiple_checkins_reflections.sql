-- WeedReset · Diário de Emoções, 13/10/2026.
-- Preserve all records; one user can create multiple check-ins on the same day.
-- Values in mood_value are legacy display weights, not clinical scores.
BEGIN;
ALTER TABLE public.mood_entries
  DROP CONSTRAINT IF EXISTS mood_entries_user_date_unique;
DROP INDEX IF EXISTS public.mood_entries_user_date_unique_idx;
CREATE INDEX IF NOT EXISTS mood_entries_user_date_time_desc_idx
  ON public.mood_entries(user_id, date DESC, time DESC, created_at DESC);
ALTER TABLE public.mood_entries
  ADD COLUMN IF NOT EXISTS trigger_note text,
  ADD COLUMN IF NOT EXISTS helpful_action text;
ALTER TABLE public.mood_entries
  ADD CONSTRAINT mood_entries_trigger_note_max_20261013
    CHECK (trigger_note IS NULL OR char_length(trigger_note) <= 160),
  ADD CONSTRAINT mood_entries_helpful_action_max_20261013
    CHECK (helpful_action IS NULL OR char_length(helpful_action) <= 160);
-- Prevent accidental public access; existing auth.uid()-based RLS policies stay intact.
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mood_entries FROM PUBLIC,anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_entries TO authenticated;
COMMENT ON COLUMN public.mood_entries.mood_value IS 'Legacy ordinal visualization weight. Never interpret as a clinical emotional percentage or risk score.';
COMMIT;