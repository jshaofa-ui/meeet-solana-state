
CREATE TABLE IF NOT EXISTS public.agent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  impact TEXT,
  debate_summary TEXT,
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  user_upvotes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  cycle_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shipped_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.agent_proposals(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  reasoning TEXT,
  weight FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_status ON public.agent_proposals(status);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_category ON public.agent_proposals(category);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_created_at ON public.agent_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_proposal_votes_proposal ON public.agent_proposal_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_agent_proposal_votes_agent ON public.agent_proposal_votes(agent_id);

ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_proposal_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read proposals"
  ON public.agent_proposals FOR SELECT USING (true);

CREATE POLICY "Allow public upvote increment"
  ON public.agent_proposals FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read proposal votes"
  ON public.agent_proposal_votes FOR SELECT USING (true);
