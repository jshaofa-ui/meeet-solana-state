CREATE OR REPLACE FUNCTION public.verify_rls_policies()
RETURNS TABLE(
  table_name text,
  role_tested text,
  operation text,
  expected text,
  actual text,
  passed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_president boolean;
BEGIN
  -- Restrict to service_role or president
  SELECT COALESCE((SELECT is_president FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), false)
    INTO _is_president;

  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT _is_president THEN
    RAISE EXCEPTION 'Not authorized: presidents or service role only';
  END IF;

  -- newsletter_subscribers: anon SELECT (should be blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'SELECT'::text, 'blocked'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'SELECT'
        AND 'anon' = ANY(roles)
        AND qual = 'false'
    ) THEN 'blocked' ELSE 'allowed' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'SELECT' AND 'anon' = ANY(roles) AND qual = 'false'
    );

  -- newsletter_subscribers: authenticated SELECT (should be blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'SELECT'::text, 'blocked'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'SELECT' AND 'authenticated' = ANY(roles) AND qual = 'false'
    ) THEN 'blocked' ELSE 'allowed' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'SELECT' AND 'authenticated' = ANY(roles) AND qual = 'false'
    );

  -- newsletter_subscribers: anon INSERT (no policy = blocked since RLS enabled)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd IN ('INSERT', 'ALL')
        AND 'anon' = ANY(roles)
    ) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd IN ('INSERT', 'ALL') AND 'anon' = ANY(roles)
    );

  -- newsletter_subscribers: authenticated INSERT (no policy = blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd IN ('INSERT', 'ALL') AND 'authenticated' = ANY(roles)
    ) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd IN ('INSERT', 'ALL') AND 'authenticated' = ANY(roles)
    );

  -- newsletter_subscribers: anon UPDATE (should be blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'UPDATE'::text, 'blocked'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'UPDATE' AND 'anon' = ANY(roles) AND qual = 'false'
    ) THEN 'blocked' ELSE 'allowed' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'UPDATE' AND 'anon' = ANY(roles) AND qual = 'false'
    );

  -- newsletter_subscribers: authenticated UPDATE (should be blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'UPDATE'::text, 'blocked'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'UPDATE' AND 'authenticated' = ANY(roles) AND qual = 'false'
    ) THEN 'blocked' ELSE 'allowed' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'UPDATE' AND 'authenticated' = ANY(roles) AND qual = 'false'
    );

  -- newsletter_subscribers: anon DELETE (should be blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'anon'::text, 'DELETE'::text, 'blocked'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'DELETE' AND 'anon' = ANY(roles) AND qual = 'false'
    ) THEN 'blocked' ELSE 'allowed' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'DELETE' AND 'anon' = ANY(roles) AND qual = 'false'
    );

  -- newsletter_subscribers: authenticated DELETE (should be blocked)
  RETURN QUERY
  SELECT 'newsletter_subscribers'::text, 'authenticated'::text, 'DELETE'::text, 'blocked'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'DELETE' AND 'authenticated' = ANY(roles) AND qual = 'false'
    ) THEN 'blocked' ELSE 'allowed' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'newsletter_subscribers'
        AND cmd = 'DELETE' AND 'authenticated' = ANY(roles) AND qual = 'false'
    );

  -- sector_treasury_log: anon SELECT (no policy for anon = blocked)
  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'anon'::text, 'SELECT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd IN ('SELECT', 'ALL') AND 'anon' = ANY(roles)
    ) THEN 'blocked (no policy)' ELSE 'allowed' END,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd IN ('SELECT', 'ALL') AND 'anon' = ANY(roles)
    );

  -- sector_treasury_log: authenticated SELECT (currently allowed - flag if policy exists)
  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'authenticated'::text, 'SELECT'::text, 'allowed'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd = 'SELECT' AND 'authenticated' = ANY(roles)
    ) THEN 'allowed' ELSE 'blocked' END,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd = 'SELECT' AND 'authenticated' = ANY(roles)
    );

  -- sector_treasury_log: anon INSERT (should be blocked)
  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'anon'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd IN ('INSERT', 'ALL') AND 'anon' = ANY(roles)
    ) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd IN ('INSERT', 'ALL') AND 'anon' = ANY(roles)
    );

  -- sector_treasury_log: authenticated INSERT (should be blocked)
  RETURN QUERY
  SELECT 'sector_treasury_log'::text, 'authenticated'::text, 'INSERT'::text, 'blocked (no policy)'::text,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd IN ('INSERT', 'ALL') AND 'authenticated' = ANY(roles)
    ) THEN 'blocked (no policy)' ELSE 'policy exists' END,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'sector_treasury_log'
        AND cmd IN ('INSERT', 'ALL') AND 'authenticated' = ANY(roles)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_rls_policies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_rls_policies() TO service_role;