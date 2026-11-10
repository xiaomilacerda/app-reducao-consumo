-- Consolidate redundant legacy profile policies.
-- Keep profiles_select_own, weedreset_profiles_admin_read, profiles_update_own and the strict insert guard.
DROP POLICY IF EXISTS "Profiles Select" ON public.profiles;
DROP POLICY IF EXISTS "User reads own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuário pode ver o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "profiles_allow_select_self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update" ON public.profiles;
DROP POLICY IF EXISTS "User updates own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuário pode atualizar o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "allow user to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "enable update for users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_allow_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_cosmetics" ON public.profiles;
