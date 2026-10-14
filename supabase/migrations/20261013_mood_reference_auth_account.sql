-- Mood records remain linked to the authenticated account even when
-- its optional profiles row has not yet been created.
-- All existing mood rows were checked to have an auth.users owner.
ALTER TABLE public.mood_entries DROP CONSTRAINT IF EXISTS mood_entries_user_id_fkey;
ALTER TABLE public.mood_entries ADD CONSTRAINT mood_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
