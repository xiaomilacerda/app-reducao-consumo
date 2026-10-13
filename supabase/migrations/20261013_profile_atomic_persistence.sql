-- WeedReset: salvamento consistente de preferências, avatar, metas e apoio.
-- Transações atômicas com usuário autorizado por auth.uid(), sem permitir
-- alteração de saldo, Premium ou dados de outra conta.
-- Aplicado no banco oficial weedreset e versionado para reproduzir os ambientes.

CREATE OR REPLACE FUNCTION public.equip_profile_avatar_secure(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); code text:=upper(btrim(coalesce(p_code,'')));
BEGIN
 IF u IS NULL OR (auth.jwt()->>'is_anonymous')='true' THEN
  RAISE EXCEPTION 'Faça login para escolher um avatar.' USING ERRCODE='42501';
 END IF;
 IF code !~ '^A([1-9]|1[0-9]|20)$' THEN
  RAISE EXCEPTION 'Avatar inválido.' USING ERRCODE='22023';
 END IF;
 IF code<>'A1' AND NOT EXISTS(
  SELECT 1 FROM public.user_store_items
  WHERE user_id=u AND item_id='avatar_'||code
 ) THEN
  RAISE EXCEPTION 'Este avatar ainda não pertence à sua conta.' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=u FOR UPDATE;
 INSERT INTO public.profiles(id,equipped_icon,updated_at)
 VALUES(u,code,now())
 ON CONFLICT(id) DO UPDATE SET equipped_icon=EXCLUDED.equipped_icon,updated_at=now();
 INSERT INTO public.user_private_state(user_id,data,updated_at)
 VALUES(u,jsonb_build_object('equippedAvatar',code),now())
 ON CONFLICT(user_id) DO UPDATE SET
 data=coalesce(public.user_private_state.data,'{}'::jsonb)
   || jsonb_build_object('equippedAvatar',code),updated_at=now();
 RETURN jsonb_build_object('ok',true,'equipped_avatar',code);
END $function$;
REVOKE ALL ON FUNCTION equip_profile_avatar_secure(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION equip_profile_avatar_secure(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_profile_preferences_secure(p_user_data jsonb, p_preferences jsonb, p_profile jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 u uuid:=auth.uid();
 v_display text;
 v_timezone text;
 v_focus text;
 v_language text;
 v_currency text;
 v_frequency_period text;
 v_last_use timestamptz;
 v_thc numeric;
 v_frequency numeric;
 v_grams numeric;
 v_daily numeric;
 v_price numeric;
 v_methods text[];
 v_private jsonb;
BEGIN
 IF u IS NULL OR (auth.jwt()->>'is_anonymous')='true' THEN
  RAISE EXCEPTION 'Faça login novamente para salvar.' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_user_data) IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_preferences) IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_profile) IS DISTINCT FROM 'object'
   OR octet_length(p_user_data::text)>32768
   OR octet_length(p_preferences::text)>8192
   OR octet_length(p_profile::text)>8192 THEN
   RAISE EXCEPTION 'Dados do perfil inválidos.' USING ERRCODE='22023';
 END IF;
 v_display:=btrim(coalesce(p_preferences->>'displayName',''));
 v_timezone:=coalesce(nullif(p_preferences->>'timezone',''),'America/Sao_Paulo');
 v_focus:=coalesce(nullif(p_preferences->>'preferredFocusArea',''),'detox');
 v_language:=coalesce(nullif(p_preferences->>'preferredLanguage',''),'pt');
 v_currency:=coalesce(nullif(p_profile->>'currency',''),'BRL');
 v_frequency_period:=coalesce(nullif(p_profile->>'frequency_period',''),'day');
 IF char_length(v_display)>80 OR char_length(coalesce(p_profile->>'main_goal',''))>500
   OR v_focus NOT IN ('detox','mood','money','health')
   OR v_language NOT IN ('pt','en','es')
   OR v_currency NOT IN ('BRL','USD','EUR')
   OR v_frequency_period NOT IN ('day','week','month')
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v_timezone)
   OR jsonb_typeof(p_preferences->'notificationsEnabled') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(p_preferences->'darkMode') IS DISTINCT FROM 'boolean' THEN
   RAISE EXCEPTION 'Confira nome, fuso horário e preferências.' USING ERRCODE='22023';
 END IF;
 BEGIN
   v_thc := (p_profile->>'thc_potency')::numeric;
   v_frequency := (p_profile->>'frequency_amount')::numeric;
   v_grams := (p_profile->>'grams_per_joint')::numeric;
   v_daily := (p_profile->>'daily_cost')::numeric;
   v_price := (p_profile->>'price_per_gram')::numeric;
   IF NULLIF(p_profile->>'last_use','') IS NOT NULL THEN
     v_last_use:=(p_profile->>'last_use')::timestamptz;
   END IF;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range
   OR invalid_datetime_format OR datetime_field_overflow THEN
   RAISE EXCEPTION 'Números ou data inválidos.' USING ERRCODE='22023';
 END;
 IF v_thc IS NULL OR v_thc NOT BETWEEN 5 AND 40
  OR v_frequency IS NULL OR v_frequency NOT BETWEEN 0 AND 1000
  OR v_grams IS NULL OR v_grams NOT BETWEEN 0 AND 100
  OR v_daily IS NULL OR v_daily NOT BETWEEN 0 AND 100000
  OR v_price IS NULL OR v_price NOT BETWEEN 0 AND 100000
  OR (v_last_use IS NOT NULL AND v_last_use>now()+interval '5 minutes') THEN
  RAISE EXCEPTION 'Revise THC, quantidade, gasto e data de consumo.' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(p_profile->'consumption_methods') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Métodos de consumo inválidos.' USING ERRCODE='22023';
 END IF;
 SELECT COALESCE(array_agg(x),ARRAY[]::text[]) INTO v_methods
 FROM jsonb_array_elements_text(p_profile->'consumption_methods') AS v(x);
 IF cardinality(v_methods)>5 OR EXISTS(
   SELECT 1 FROM unnest(v_methods) x
   WHERE x NOT IN ('joint','vape','bong','edible','other')
 ) THEN
   RAISE EXCEPTION 'Método de consumo inválido.' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=u FOR UPDATE;
 INSERT INTO public.user_private_state (user_id,data,updated_at)
 VALUES (u, p_preferences || jsonb_build_object('userData',p_user_data),now())
 ON CONFLICT(user_id) DO UPDATE SET
 data=coalesce(public.user_private_state.data,'{}'::jsonb)
   || EXCLUDED.data
   || jsonb_build_object('userData',
      coalesce(public.user_private_state.data->'userData','{}'::jsonb) || p_user_data),
 updated_at=now()
 RETURNING data INTO v_private;

 INSERT INTO public.profiles(id,display_name,thc_potency,main_goal,timezone,
 preferred_language,currency,frequency_amount,frequency_period,
 grams_per_joint,daily_cost,price_per_gram,consumption_methods,last_use,updated_at)
 VALUES (u,NULLIF(v_display,''),v_thc,coalesce(nullif(btrim(p_profile->>'main_goal'),''),'Reduzir o consumo'),
 v_timezone,v_language,v_currency,v_frequency,v_frequency_period,
 v_grams,v_daily,v_price,v_methods,v_last_use,now())
 ON CONFLICT(id) DO UPDATE SET
 display_name=EXCLUDED.display_name,thc_potency=EXCLUDED.thc_potency,
 main_goal=EXCLUDED.main_goal,timezone=EXCLUDED.timezone,
 preferred_language=EXCLUDED.preferred_language,currency=EXCLUDED.currency,
 frequency_amount=EXCLUDED.frequency_amount,frequency_period=EXCLUDED.frequency_period,
 grams_per_joint=EXCLUDED.grams_per_joint,daily_cost=EXCLUDED.daily_cost,
 price_per_gram=EXCLUDED.price_per_gram,consumption_methods=EXCLUDED.consumption_methods,
 last_use=coalesce(EXCLUDED.last_use,public.profiles.last_use),
 updated_at=now();
 RETURN jsonb_build_object('ok',true,'updated_at',now());
END $function$;
REVOKE ALL ON FUNCTION save_profile_preferences_secure(jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_profile_preferences_secure(jsonb,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_profile_growth_goal(p_goal_kind text, p_goal_target numeric, p_goal_deadline date, p_baseline_weekly_spend numeric, p_money_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR (auth.jwt()->>'is_anonymous')='true' THEN
  RAISE EXCEPTION 'Sessão necessária.' USING ERRCODE='42501';END IF;
 IF p_goal_kind NOT IN('checkins','sessions','spending')
 OR p_money_currency NOT IN('BRL','USD','EUR')
 OR p_goal_target IS NULL
 OR (p_baseline_weekly_spend IS NOT NULL AND p_baseline_weekly_spend NOT BETWEEN 0 AND 100000)
 OR NOT (
   (p_goal_kind='checkins' AND p_goal_target=trunc(p_goal_target) AND p_goal_target BETWEEN 1 AND 7)
   OR (p_goal_kind='sessions' AND p_goal_target=trunc(p_goal_target) AND p_goal_target BETWEEN 1 AND 100)
   OR (p_goal_kind='spending' AND p_goal_target BETWEEN 1 AND 100000)
 ) THEN RAISE EXCEPTION 'Meta inválida.' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM auth.users WHERE id=u FOR UPDATE;
 INSERT INTO public.profile_growth_settings(user_id,goal_kind,goal_target,goal_deadline,
 baseline_weekly_spend,money_currency,updated_at)
 VALUES(u,p_goal_kind,p_goal_target,p_goal_deadline,p_baseline_weekly_spend,p_money_currency,now())
 ON CONFLICT(user_id) DO UPDATE SET
 goal_kind=EXCLUDED.goal_kind,goal_target=EXCLUDED.goal_target,
 goal_deadline=EXCLUDED.goal_deadline,baseline_weekly_spend=EXCLUDED.baseline_weekly_spend,
 money_currency=EXCLUDED.money_currency,updated_at=now();
 RETURN jsonb_build_object('ok',true);
END $function$;
REVOKE ALL ON FUNCTION update_profile_growth_goal(text,numeric,date,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION update_profile_growth_goal(text,numeric,date,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_profile_growth_support(p_triggers text[], p_coping_actions text[], p_support_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR (auth.jwt()->>'is_anonymous')='true' THEN
  RAISE EXCEPTION 'Sessão necessária.' USING ERRCODE='42501';END IF;
 IF coalesce(cardinality(p_triggers),0)>3 OR coalesce(cardinality(p_coping_actions),0)>3
 OR char_length(coalesce(array_to_string(p_triggers,' '),''))>300
 OR char_length(coalesce(array_to_string(p_coping_actions,' '),''))>450
 OR char_length(coalesce(p_support_label,''))>80 THEN
  RAISE EXCEPTION 'Plano de apoio excede o limite permitido.' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=u FOR UPDATE;
 INSERT INTO public.profile_growth_settings(user_id,triggers,coping_actions,support_label,updated_at)
 VALUES(u,coalesce(p_triggers,ARRAY[]::text[]),coalesce(p_coping_actions,ARRAY[]::text[]),
 NULLIF(btrim(p_support_label),''),now())
 ON CONFLICT(user_id) DO UPDATE SET
 triggers=EXCLUDED.triggers,coping_actions=EXCLUDED.coping_actions,
 support_label=EXCLUDED.support_label,updated_at=now();
 RETURN jsonb_build_object('ok',true);
END $function$;
REVOKE ALL ON FUNCTION update_profile_growth_support(text[],text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION update_profile_growth_support(text[],text[],text) TO authenticated;
