DROP VIEW IF EXISTS public.active_alerts;
CREATE VIEW public.active_alerts
  WITH (security_invoker = true)
  AS
  SELECT id, event_type, severity, source_ip, email, user_id, details, created_at
    FROM public.security_events
   WHERE alert_sent = true
     AND created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;