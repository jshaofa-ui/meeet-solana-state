CREATE TABLE IF NOT EXISTS public.agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL,
  result TEXT,
  topic TEXT,
  summary TEXT,
  agent_argument TEXT,
  opponent_argument TEXT,
  learned_pattern TEXT,
  meeet_earned DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read interactions" ON public.agent_interactions;
CREATE POLICY "Allow public read interactions"
  ON public.agent_interactions
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_interactions_agent ON public.agent_interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_interactions_opponent ON public.agent_interactions(opponent_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON public.agent_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON public.agent_interactions(interaction_type);