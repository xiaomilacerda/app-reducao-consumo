
-- Legacy gamification tables must not let the browser mint items, levels or awards.
-- Server-owned reward/checkout functions continue to operate with their own privileges.
REVOKE INSERT, UPDATE, DELETE ON public.user_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_levels FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_rewards_log FROM PUBLIC, anon, authenticated;
