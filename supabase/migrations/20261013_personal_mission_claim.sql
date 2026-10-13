-- WeedReset: função segura de conclusão de missão baseada no início da jornada.
-- Aplicada primeiro no projeto oficial weedreset. Mantém a função legada
-- claim_mission_secure para compatibilidade com deploys antigos.
-- Requer tabelas missions, profiles, user_private_state, user_missions,
-- engagement_mission_claims, user_wallet e user_rewards_log.
-- A migration não apaga registros nem altera recompensas passadas.
CREATE OR REPLACE FUNCTION public.claim_personal_mission_secure(p_mission_id bigint, p_answer text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_user uuid:=auth.uid();
 v_tz text;
 v_today date;
 v_m public.missions%ROWTYPE;
 v_kind text;
 v_premium boolean;
 v_xp integer;
 v_coins integer;
 v_claimed boolean;
 v_day integer;
 v_start timestamptz;
 v_start_text text;
BEGIN
 IF v_user IS NULL OR (auth.jwt()->>'is_anonymous')='true' THEN
  RAISE EXCEPTION 'Entre em sua conta.' USING ERRCODE='42501';
 END IF;
 IF length(coalesce(p_answer,''))>2000 THEN
  RAISE EXCEPTION 'A resposta deve ter no máximo 2.000 caracteres.' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(nullif(timezone,''),'America/Sao_Paulo'),coalesce(is_premium,false)
 INTO v_tz,v_premium FROM public.profiles WHERE id=v_user;
 IF v_tz IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v_tz) THEN v_tz:='America/Sao_Paulo';END IF;
 v_today:=(now() AT TIME ZONE v_tz)::date;
 SELECT created_at INTO v_start FROM public.profiles WHERE id=v_user;
 SELECT coalesce(
   nullif(data->'userData'->>'detoxCycleStartDate',''),
   nullif(data->'userData'->>'startDate','')
 ) INTO v_start_text FROM public.user_private_state WHERE user_id=v_user;
 IF v_start_text IS NOT NULL THEN
   BEGIN
     v_start:=v_start_text::timestamptz;
   EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
     -- Dados de onboarding antigos podem conter datas incompletas.
     NULL;
   END;
 END IF;
 IF v_start IS NULL THEN v_start:=now();END IF;
 v_day:=greatest(1,least(365, (v_today - (v_start AT TIME ZONE v_tz)::date) + 1));
 SELECT * INTO v_m FROM public.missions WHERE id=p_mission_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missão não encontrada.' USING ERRCODE='22023';END IF;
 IF v_m.type='daily' AND coalesce(v_m.premium_only,false)=false AND coalesce(v_m.is_premium_only,false)=false THEN
   v_kind:='daily';
   IF v_m.day_index IS DISTINCT FROM v_day THEN
     RAISE EXCEPTION 'Esta missão pertence a outro dia. Atualize a página.' USING ERRCODE='22023';
   END IF;
 ELSIF (coalesce(v_m.premium_only,false) OR coalesce(v_m.is_premium_only,false) OR v_m.type='premium') AND v_premium THEN
   v_kind:='premium';
 ELSE
   RAISE EXCEPTION 'Missão indisponível para esta conta.' USING ERRCODE='42501';
 END IF;
 v_xp:=least(greatest(coalesce(v_m.reward_xp,0),0),100);
 v_coins:=least(greatest(coalesce(v_m.reward_coins,0),0),30);
 PERFORM 1 FROM auth.users WHERE id=v_user FOR UPDATE;
 -- Evita recompensar outro desafio do mesmo tipo se o app antigo já
 -- registrou uma conclusão hoje (incluindo sem comprovante do novo fluxo).
 IF EXISTS (
    SELECT 1 FROM public.user_missions prior
    JOIN public.missions previous ON previous.id=prior.mission_id
    WHERE prior.user_id=v_user AND prior.completed=true
    AND (
      (v_kind='daily' AND previous.type='daily'
        AND coalesce(previous.premium_only,false)=false
        AND coalesce(previous.is_premium_only,false)=false)
      OR (v_kind='premium' AND
        (previous.type='premium' OR coalesce(previous.premium_only,false)
         OR coalesce(previous.is_premium_only,false)))
    )
    AND (
      prior.progress->>'day_key'=v_today::text OR
      (prior.completed_at IS NOT NULL AND
        (prior.completed_at AT TIME ZONE v_tz)::date=v_today)
    )
 ) THEN
    RETURN jsonb_build_object('ok',false,'already_completed',true,
      'message','Você já concluiu este tipo de desafio hoje.');
 END IF;
 IF EXISTS (
    SELECT 1 FROM public.user_missions um
    WHERE um.user_id=v_user AND um.mission_id=p_mission_id
      AND (um.progress->>'day_key'=v_today::text
          OR (um.completed_at IS NOT NULL AND
              (um.completed_at AT TIME ZONE v_tz)::date=v_today))
 ) THEN
    RETURN jsonb_build_object('ok',false,'already_completed',true,
      'message','Esta missão já foi concluída hoje.');
 END IF;
 INSERT INTO public.engagement_mission_claims(user_id,mission_id,day_date,kind,xp_awarded,coins_awarded)
 VALUES(v_user,p_mission_id,v_today,v_kind,v_xp,v_coins)
 ON CONFLICT (user_id,kind,day_date) DO NOTHING;
 v_claimed:=FOUND;
 IF NOT v_claimed THEN
   RETURN jsonb_build_object('ok',false,'already_completed',true,'message','A missão de hoje já foi concluída.');
 END IF;
 INSERT INTO public.user_missions(user_id,mission_id,completed,status,completed_at,last_update,progress)
 VALUES(v_user,p_mission_id,true,'completed',now(),now(),
   jsonb_build_object('day_key',v_today,'answer_text',btrim(coalesce(p_answer,''))))
 ON CONFLICT(user_id,mission_id) DO UPDATE SET
   completed=true,status='completed',completed_at=now(),last_update=now(),
   progress=coalesce(public.user_missions.progress,'{}'::jsonb)
    ||jsonb_build_object('day_key',v_today,'answer_text',btrim(coalesce(p_answer,'')));
 -- A reflexão da missão fica em user_missions.progress.answer_text;
 -- mission_journal é exclusivo da Jornada 365 (não criar duplicatas).
 UPDATE public.profiles SET xp=coalesce(xp,0)+v_xp WHERE id=v_user;
 INSERT INTO public.user_wallet(user_id,coins,updated_at) VALUES(v_user,v_coins,now())
 ON CONFLICT(user_id) DO UPDATE SET coins=coalesce(public.user_wallet.coins,0)+v_coins,updated_at=now();
 INSERT INTO public.user_rewards_log(user_id,mission_id,mission_title,reward_xp,reward_coins,metadata)
 VALUES(v_user,p_mission_id,v_m.title,v_xp,v_coins,
   jsonb_build_object('day_key',v_today,'kind',v_kind,'source','claim_personal_mission_secure'));
 RETURN jsonb_build_object('ok',true,'xp',v_xp,'coins',v_coins,'kind',v_kind,'day_key',v_today);
END $function$

REVOKE ALL ON FUNCTION public.claim_personal_mission_secure(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_personal_mission_secure(bigint,text) TO authenticated;
