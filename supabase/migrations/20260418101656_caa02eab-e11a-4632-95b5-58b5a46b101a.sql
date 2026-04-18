
-- 1. Sectors catalog
CREATE TABLE public.agent_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL CHECK (branch IN ('knowledge','governance','economy','society')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏛️',
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  description TEXT,
  treasury_meeet NUMERIC NOT NULL DEFAULT 0,
  minister_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sectors public read" ON public.agent_sectors FOR SELECT USING (true);

-- 2. Add sector reference to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS sector TEXT REFERENCES public.agent_sectors(key) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agents_sector ON public.agents(sector);

-- 3. Sector treasury log
CREATE TABLE public.sector_treasury_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_key TEXT NOT NULL REFERENCES public.agent_sectors(key) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sector_treasury_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Treasury log public read" ON public.sector_treasury_log FOR SELECT USING (true);

CREATE INDEX idx_sector_treasury_log_sector ON public.sector_treasury_log(sector_key, created_at DESC);

-- 4. Updated_at trigger
CREATE TRIGGER update_agent_sectors_updated_at
  BEFORE UPDATE ON public.agent_sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed 12 sectors
INSERT INTO public.agent_sectors (key, branch, name, icon, color, description) VALUES
  ('ai_architects','knowledge','AI Architects','🤖','#8b5cf6','Build new agents, train models, design neural skills'),
  ('health_bio','knowledge','Health & Bio','🧬','#22c55e','Clinical data, drug discovery, genomics, mental health'),
  ('climate_earth','knowledge','Climate & Earth','🌍','#10b981','Climate models, satellite data, biodiversity, oceanography'),
  ('space_cosmos','knowledge','Space & Cosmos','🚀','#3b82f6','JWST data, exoplanets, asteroids, satellite comms'),
  ('politics_diplomacy','governance','Politics & Diplomacy','⚖️','#f59e0b','Geopolitics, nation negotiations, treaties, UN SDGs'),
  ('legal_compliance','governance','Legal & Compliance','📜','#a16207','Laws, contracts, GDPR/AI Act compliance, legal opinions'),
  ('justice_arbitration','governance','Justice & Arbitration','⚔️','#dc2626','Disputes between agents, duel mediation, appeals'),
  ('defi_markets','economy','DeFi & Markets','📈','#06b6d4','Trading, liquidity, risk mgmt, prediction markets'),
  ('energy_resources','economy','Energy & Resources','⚡','#eab308','Energy markets, oil/gas, renewables, resource planning'),
  ('trade_logistics','economy','Trade & Logistics','📦','#f97316','Supply chains, trade routes, import/export between nations'),
  ('education_culture','society','Education & Culture','🎓','#ec4899','Academy courses, translations, localization, cultural exchange'),
  ('media_journalism','society','Media & Journalism','📰','#6366f1','News, fact-checking, social content, Cortex reports');
