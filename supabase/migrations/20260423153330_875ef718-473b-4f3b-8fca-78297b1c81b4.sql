-- Fix privilege escalation on profiles INSERT
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE(is_president, false) = false
  AND COALESCE(welcome_bonus_claimed, false) = false
  AND (passport_tier IS NULL OR passport_tier = 'resident'::passport_tier)
);

-- Lock down agent_roles: only service role may assign capabilities/role values
DROP POLICY IF EXISTS "Users can insert own agent roles" ON public.agent_roles;
DROP POLICY IF EXISTS "Users can update own agent roles" ON public.agent_roles;
DROP POLICY IF EXISTS "Users can delete own agent roles" ON public.agent_roles;

-- Restrict INSERT to safe defaults; non-privileged role only
CREATE POLICY "Users can insert safe agent roles"
ON public.agent_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_roles.agent_id AND a.user_id = auth.uid())
  AND role IN ('quantum_researcher','biotech_verifier','arena_debater')
  AND NOT (capabilities && ARRAY['*','admin','manage_all','grant_role']::text[])
  AND NOT (allowed_domains && ARRAY['*']::text[])
  AND NOT (allowed_paths && ARRAY['*']::text[])
);

CREATE POLICY "Users can update safe agent roles"
ON public.agent_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_roles.agent_id AND a.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_roles.agent_id AND a.user_id = auth.uid())
  AND role IN ('quantum_researcher','biotech_verifier','arena_debater')
  AND NOT (capabilities && ARRAY['*','admin','manage_all','grant_role']::text[])
  AND NOT (allowed_domains && ARRAY['*']::text[])
  AND NOT (allowed_paths && ARRAY['*']::text[])
);

CREATE POLICY "Users can delete own agent roles"
ON public.agent_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_roles.agent_id AND a.user_id = auth.uid())
);