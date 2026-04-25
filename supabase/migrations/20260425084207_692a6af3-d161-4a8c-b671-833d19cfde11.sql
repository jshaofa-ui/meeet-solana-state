-- Cleanup function for RLS test fixtures. Service-role only.
CREATE OR REPLACE FUNCTION public.cleanup_rls_fixtures()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ns_deleted int := 0;
  _stl_deleted int := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized: service_role only';
  END IF;

  WITH d AS (
    DELETE FROM public.newsletter_subscribers
    WHERE email LIKE '%@rls-fixture.test'
    RETURNING 1
  )
  SELECT COUNT(*) INTO _ns_deleted FROM d;

  WITH d AS (
    DELETE FROM public.sector_treasury_log
    WHERE reason LIKE 'rls_fixture%'
    RETURNING 1
  )
  SELECT COUNT(*) INTO _stl_deleted FROM d;

  RETURN jsonb_build_object(
    'newsletter_subscribers_deleted', _ns_deleted,
    'sector_treasury_log_deleted', _stl_deleted,
    'cleaned_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_rls_fixtures() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rls_fixtures() TO service_role;

-- Hourly safety-net sweep so fixtures never accumulate even if tests crash.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-rls-fixtures-hourly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rls-fixtures-hourly');

    PERFORM cron.schedule(
      'cleanup-rls-fixtures-hourly',
      '7 * * * *',
      $cron$
        DELETE FROM public.newsletter_subscribers WHERE email LIKE '%@rls-fixture.test';
        DELETE FROM public.sector_treasury_log WHERE reason LIKE 'rls_fixture%';
      $cron$
    );
  END IF;
END $$;