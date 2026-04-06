
CREATE TABLE public.verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  tool_name TEXT NOT NULL,
  discovery_id TEXT,
  vote TEXT,
  confidence NUMERIC,
  result_data JSONB,
  reputation_delta INTEGER DEFAULT 0,
  stake_result TEXT DEFAULT 'none',
  receipt JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on verifications"
  ON public.verifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read own verifications"
  ON public.verifications FOR SELECT
  TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
