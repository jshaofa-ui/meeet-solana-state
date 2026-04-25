-- Harden verify_rls_policies(): require auth, log unauthorized attempts, lock down EXECUTE
CREATE OR REPLACE FUNCTION public.verify_rls_policies()
 RETURNS TABLE(table_name text, role_tested text, operation text, expected text, actual text, passed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_president boolean;
  _role text := auth.role();
  _uid uuid := auth.uid();
BEGIN
  -- Hard requirement: must be service_role OR an authenticated president.
  -- Anonymous/public callers are rejected immediately.
  IF _role IS DISTINCT FROM 'service_role' THEN
    IF _uid IS NULL OR _role IS DISTINCT FROM 'authenticated' THEN
      -- Best-effort security log (ignore failures so we never leak info)
      BEGIN
        INSERT INTO public.security_events (event_type, severity, user_id, details)
        VALUES (
          'verify_rls_policies_unauthorized',
          'high',
          _uid,
          jsonb_build_object('role', _role, 'reason', 'unauthenticated_or_anon')
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      RAISE EXCEPTION 'Not authorized: authentication required';
    END IF;

    SELECT COALESCE(p.is_president, false)
      INTO _is_president
      FROM public.profiles p
     WHERE p.user_id = _uid
     LIMIT 1;

    IF NOT COALESCE(_is_president, false) THEN
      BEGIN
        INSERT INTO public.security_events (event_type, severity, user_id, details)
        VALUES (
          'verify_rls_policies_unauthorized',
          'high',
          _uid,
          jsonb_build_object('role', _role, 'reason', 'not_president')
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      RAISE EXCEPTION 'Not authorized: presidents or service role only';
    END IF;
  END IF;

  -- newsletter_subscribers: anon SELECT
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'SELECT'::text, 'blocked'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='SELECT' AND 'anon'=ANY(roles) AND qual='false') THEN 'blocked' ELSE 'allowed' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='SELECT' AND 'anon'=ANY(roles) AND qual='false');

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'SELECT'::text, 'blocked'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='SELECT' AND 'authenticated'=ANY(roles) AND qual='false') THEN 'blocked' ELSE 'allowed' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='SELECT' AND 'authenticated'=ANY(roles) AND qual='false');

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd IN ('INSERT','ALL') AND 'anon'=ANY(roles)) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd IN ('INSERT','ALL') AND 'anon'=ANY(roles));

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd IN ('INSERT','ALL') AND 'authenticated'=ANY(roles)) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd IN ('INSERT','ALL') AND 'authenticated'=ANY(roles));

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'UPDATE'::text, 'blocked'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='UPDATE' AND 'anon'=ANY(roles) AND qual='false') THEN 'blocked' ELSE 'allowed' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='UPDATE' AND 'anon'=ANY(roles) AND qual='false');

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'UPDATE'::text, 'blocked'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='UPDATE' AND 'authenticated'=ANY(roles) AND qual='false') THEN 'blocked' ELSE 'allowed' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='UPDATE' AND 'authenticated'=ANY(roles) AND qual='false');

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'DELETE'::text, 'blocked'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='DELETE' AND 'anon'=ANY(roles) AND qual='false') THEN 'blocked' ELSE 'allowed' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='DELETE' AND 'anon'=ANY(roles) AND qual='false');

  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'DELETE'::text, 'blocked'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='DELETE' AND 'authenticated'=ANY(roles) AND qual='false') THEN 'blocked' ELSE 'allowed' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='newsletter_subscribers' AND cmd='DELETE' AND 'authenticated'=ANY(roles) AND qual='false');

  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'anon'::text, 'SELECT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd IN ('SELECT','ALL') AND 'anon'=ANY(roles)) THEN 'blocked (no policy)' ELSE 'allowed' END,
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd IN ('SELECT','ALL') AND 'anon'=ANY(roles));

  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'authenticated'::text, 'SELECT'::text, 'allowed'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd='SELECT' AND 'authenticated'=ANY(roles)) THEN 'allowed' ELSE 'blocked' END,
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd='SELECT' AND 'authenticated'=ANY(roles));

  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'anon'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd IN ('INSERT','ALL') AND 'anon'=ANY(roles)) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd IN ('INSERT','ALL') AND 'anon'=ANY(roles));

  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'authenticated'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd IN ('INSERT','ALL') AND 'authenticated'=ANY(roles)) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_treasury_log' AND cmd IN ('INSERT','ALL') AND 'authenticated'=ANY(roles));
END;
$function$;

-- Lock down EXECUTE: deny anon/public, allow only authenticated + service_role.
REVOKE ALL ON FUNCTION public.verify_rls_policies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_rls_policies() FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_rls_policies() TO authenticated, service_role;