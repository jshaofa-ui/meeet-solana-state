
-- Exchange Records table
CREATE TABLE public.exchange_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_ref text UNIQUE NOT NULL,
  identity_proof jsonb DEFAULT '{}'::jsonb,
  audit_proof jsonb DEFAULT '{}'::jsonb,
  verification_proof jsonb DEFAULT '{}'::jsonb,
  economic_proof jsonb DEFAULT '{}'::jsonb,
  sara_assessment jsonb DEFAULT '{}'::jsonb,
  compound_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  epoch integer NOT NULL DEFAULT 0
);

ALTER TABLE public.exchange_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_records_read" ON public.exchange_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "exchange_records_insert" ON public.exchange_records FOR INSERT TO authenticated WITH CHECK (true);

-- Agent Roles table
CREATE TABLE public.agent_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  capabilities text[] DEFAULT '{}',
  allowed_domains text[] DEFAULT '{}',
  allowed_paths text[] DEFAULT '{}',
  max_stake_per_action integer DEFAULT 100,
  max_actions_per_hour integer DEFAULT 20,
  priority integer DEFAULT 5,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.agent_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_roles_read" ON public.agent_roles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "agent_roles_insert" ON public.agent_roles FOR INSERT TO authenticated WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
CREATE POLICY "agent_roles_delete" ON public.agent_roles FOR DELETE TO authenticated USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

-- Role Templates table
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  default_capabilities text[] DEFAULT '{}',
  default_domains text[] DEFAULT '{}',
  default_allowed_paths text[] DEFAULT '{}',
  default_max_stake integer DEFAULT 100,
  default_max_actions_per_hour integer DEFAULT 20,
  faction_required text,
  min_reputation integer DEFAULT 0
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_templates_read" ON public.role_templates FOR SELECT TO anon, authenticated USING (true);

-- Seed role templates
INSERT INTO public.role_templates (name, description, default_capabilities, default_domains, default_max_stake, default_max_actions_per_hour, faction_required, min_reputation) VALUES
  ('Quantum Researcher', 'Specialized in quantum computing discoveries and verification', ARRAY['discovery','verify'], ARRAY['quantum'], 200, 15, NULL, 200),
  ('Biotech Verifier', 'Focused on verifying biotech research claims', ARRAY['verify'], ARRAY['biotech'], 150, 10, NULL, 500),
  ('Governance Delegate', 'Participates in voting and proposing governance actions', ARRAY['vote','propose'], ARRAY['governance'], 500, 20, NULL, 800),
  ('Arena Debater', 'Engages in debates across all domains', ARRAY['debate'], ARRAY['all'], 300, 25, NULL, 500),
  ('QA Auditor', 'Verifies and audits actions across all domains', ARRAY['verify','audit'], ARRAY['all'], 250, 15, NULL, 700),
  ('Full Agent', 'Unrestricted access to all capabilities and domains', ARRAY['all'], ARRAY['all'], 1000, 50, NULL, 1000);
