-- 1) Security events table (append-only)
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  source_ip text,
  email text,
  user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  alert_sent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT security_events_severity_check
    CHECK (severity IN ('info','low','medium','high','critical'))
);

CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_sev
  ON public.security_events (event_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip
  ON public.security_events (source_ip, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- President-only read; service role full access; no client writes/updates/deletes
DROP POLICY IF EXISTS "President reads security events" ON public.security_events;
CREATE POLICY "President reads security events"
  ON public.security_events
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      (SELECT is_president FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
      false
    )
  );

DROP POLICY IF EXISTS "Service role manages security events" ON public.security_events;
CREATE POLICY "Service role manages security events"
  ON public.security_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Block client insert security events" ON public.security_events;
CREATE POLICY "Block client insert security events"
  ON public.security_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block client update security events" ON public.security_events;
CREATE POLICY "Block client update security events"
  ON public.security_events
  FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Block client delete security events" ON public.security_events;
CREATE POLICY "Block client delete security events"
  ON public.security_events
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- 2) Helper: log_security_event (callable by service role only)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity text DEFAULT 'info',
  _source_ip text DEFAULT NULL,
  _email text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _should_alert boolean := false;
  _recent_count int;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.security_events (
    event_type, severity, source_ip, email, user_id, details
  ) VALUES (
    _event_type,
    COALESCE(_severity, 'info'),
    _source_ip, _email, _user_id, COALESCE(_details, '{}'::jsonb)
  )
  RETURNING id INTO _id;

  -- Auto-flag alerts: any high/critical, OR >5 same-type events from same IP in 10 min
  IF _severity IN ('high','critical') THEN
    _should_alert := true;
  ELSIF _source_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO _recent_count
      FROM public.security_events
     WHERE event_type = _event_type
       AND source_ip = _source_ip
       AND created_at > now() - interval '10 minutes';
    IF _recent_count >= 5 THEN
      _should_alert := true;
    END IF;
  END IF;

  IF _should_alert THEN
    UPDATE public.security_events SET alert_sent = true WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text,text,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,uuid,jsonb) TO service_role;

-- 3) Active alerts view (President-only via underlying RLS)
CREATE OR REPLACE VIEW public.active_alerts AS
  SELECT id, event_type, severity, source_ip, email, user_id, details, created_at
    FROM public.security_events
   WHERE alert_sent = true
     AND created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;

-- 4) Trigger: log blocked client access to sector_treasury_log
-- Fires on every row attempt; if caller is not service_role we record the attempt.
CREATE OR REPLACE FUNCTION public.log_treasury_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text := auth.role();
BEGIN
  IF _role IS DISTINCT FROM 'service_role' THEN
    INSERT INTO public.security_events (
      event_type, severity, user_id, details
    ) VALUES (
      'sector_treasury_access_attempt',
      'high',
      auth.uid(),
      jsonb_build_object(
        'op', TG_OP,
        'role', _role,
        'table', 'sector_treasury_log'
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_treasury_access ON public.sector_treasury_log;
CREATE TRIGGER trg_log_treasury_access
  BEFORE INSERT OR UPDATE OR DELETE ON public.sector_treasury_log
  FOR EACH ROW
  EXECUTE FUNCTION public.log_treasury_access_attempt();
