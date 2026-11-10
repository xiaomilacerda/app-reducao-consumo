-- Release migration: purge user-to-user block associations before deleting profiles.
CREATE OR REPLACE FUNCTION public.weedreset_purge_account_data(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_table record;
  v_affected integer;
  v_total integer := 0;
BEGIN
  IF (select auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation requires the service role'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user id' USING ERRCODE = '22023';
  END IF;

  -- Remove reports involving this account, including reporter/resolved_by.
  DELETE FROM public.community_blocks WHERE blocker_id = p_user_id OR blocked_id = p_user_id;

  DELETE FROM public.community_reports
  WHERE reporter_id = p_user_id
     OR target_user_id = p_user_id
     OR resolved_by = p_user_id;

  -- Public tables with a user_id column are owned user records. Delete them
  -- in an order that respects the community post/comment references.
  FOR v_table IN
    SELECT c.table_name
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND c.udt_name = 'uuid'
      AND c.table_name NOT IN ('profiles')
    ORDER BY CASE c.table_name
      WHEN 'community_notifications' THEN 1
      WHEN 'community_likes' THEN 2
      WHEN 'community_reports' THEN 3
      WHEN 'community_comments' THEN 4
      WHEN 'community_posts' THEN 5
      ELSE 6
    END, c.table_name
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table.table_name)
      USING p_user_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    v_total := v_total + v_affected;
  END LOOP;

  -- Delete ancillary accounts, archives and audit associations.
  DELETE FROM public.admin_logs WHERE admin_id = p_user_id;
  DELETE FROM public.admin_users WHERE id = p_user_id;
  DELETE FROM public.profiles_backup WHERE id = p_user_id;

  -- CASCADE deletes the additional tables referencing profiles.
  DELETE FROM public.profiles WHERE id = p_user_id;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  v_total := v_total + v_affected;

  RETURN v_total;
END
$function$
;
REVOKE ALL ON FUNCTION public.weedreset_purge_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weedreset_purge_account_data(uuid) TO service_role;
