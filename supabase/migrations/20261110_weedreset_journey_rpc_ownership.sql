-- WeedReset release hardening: a SECURITY DEFINER RPC must not disclose
-- another user's Journey 365 completion state through p_user_id.
-- Verified against the live function signature on 2026-11-10.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_journey_missions(
  p_user_id uuid,
  p_day integer
)
RETURNS TABLE(
  mission_id bigint,
  title text,
  description text,
  journey_day integer,
  journey_phase text,
  completed boolean,
  completed_at timestamptz,
  reward_coins integer,
  reward_xp integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Acesso não autorizado aos dados da jornada.'
      USING ERRCODE = '42501';
  END IF;

  IF p_day IS NULL OR p_day < 1 OR p_day > 365 THEN
    RAISE EXCEPTION 'Dia da jornada inválido.'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.description,
    m.journey_day,
    m.journey_phase,
    COALESCE(um.completed, false),
    um.completed_at,
    m.reward_coins,
    m.reward_xp
  FROM public.missions AS m
  LEFT JOIN public.user_missions AS um
    ON um.mission_id = m.id
   AND um.user_id = p_user_id
  WHERE m.category = 'Jornada 365'
    AND m.journey_day = p_day
  ORDER BY m.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_journey_missions(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_journey_missions(uuid, integer) TO authenticated, service_role;

COMMIT;
