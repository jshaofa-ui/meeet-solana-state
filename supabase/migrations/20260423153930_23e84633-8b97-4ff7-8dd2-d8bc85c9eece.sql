-- Tighten RLS on trial_agents: prevent abuse via public INSERT policy
DROP POLICY IF EXISTS "Anyone can create trial agents" ON public.trial_agents;

CREATE POLICY "Public can create limited trial agents"
ON public.trial_agents
FOR INSERT
TO public
WITH CHECK (
  converted = false
  AND length(session_id) BETWEEN 8 AND 128
  AND length(agent_name) BETWEEN 1 AND 64
  AND length(agent_type) BETWEEN 1 AND 32
);

-- Hard cap: max 3 trial agents per session_id (defense-in-depth)
CREATE OR REPLACE FUNCTION public.enforce_trial_agent_session_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int;
BEGIN
  SELECT COUNT(*) INTO _count
  FROM public.trial_agents
  WHERE session_id = NEW.session_id;
  IF _count >= 3 THEN
    RAISE EXCEPTION 'Trial agent limit reached for this session';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trial_agents_session_limit ON public.trial_agents;
CREATE TRIGGER trg_trial_agents_session_limit
BEFORE INSERT ON public.trial_agents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_trial_agent_session_limit();