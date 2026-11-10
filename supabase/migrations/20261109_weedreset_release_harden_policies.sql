-- Critical release hardening: preserve strict rules; remove permissive legacy alternatives.
DROP POLICY IF EXISTS "Criar perfil ao registrar" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Insert" ON public.profiles;
DROP POLICY IF EXISTS "User inserts own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_allow_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_write" ON public.profiles;
REVOKE DELETE ON public.profiles FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.community_comments;
DROP POLICY IF EXISTS "Usuário pode criar comentários" ON public.community_comments;
DROP POLICY IF EXISTS "comments_insert_allowed" ON public.community_comments;
DROP POLICY IF EXISTS "Usuário pode criar posts" ON public.community_posts;
DROP POLICY IF EXISTS "premium_can_insert_posts" ON public.community_posts;
