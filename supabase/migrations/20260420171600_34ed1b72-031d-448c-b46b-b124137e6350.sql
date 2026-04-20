
DROP VIEW IF EXISTS public.user_bots_safe;

DROP POLICY IF EXISTS "Users read own bots" ON public.user_bots;

CREATE VIEW public.user_bots_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  agent_id,
  bot_username,
  bot_name,
  status,
  created_at,
  updated_at,
  (webhook_secret IS NOT NULL) AS has_webhook_secret,
  (bot_token IS NOT NULL) AS has_bot_token
FROM public.user_bots
WHERE (auth.uid())::text = user_id;

GRANT SELECT ON public.user_bots_safe TO authenticated;

DROP POLICY IF EXISTS "Anyone can read interactions" ON public.interactions;

CREATE POLICY "Participants can read interactions"
ON public.interactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id IN (interactions.initiator_id, interactions.responder_id)
      AND a.user_id = auth.uid()
  )
);
