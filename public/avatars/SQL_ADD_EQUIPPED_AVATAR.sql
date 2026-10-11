-- WeedReset — Avatares base (AV1/AV2)
-- Objetivo: separar o avatar base (anônimo) do emblema (A1..A20).
--
-- 1) Cria coluna no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_avatar TEXT;

-- 2) Define default para novos usuários
ALTER TABLE public.profiles
  ALTER COLUMN equipped_avatar SET DEFAULT 'AV1';

-- 3) Preenche usuários antigos
UPDATE public.profiles
SET equipped_avatar = 'AV1'
WHERE equipped_avatar IS NULL OR btrim(equipped_avatar) = '';

-- (Opcional) Se você quiser travar só AV1/AV2, descomente a constraint abaixo.
-- ATENÇÃO: só faça isso depois de garantir que não há valores diferentes.
-- ALTER TABLE public.profiles
--   ADD CONSTRAINT profiles_equipped_avatar_chk
--   CHECK (equipped_avatar IN ('AV1','AV2'));
