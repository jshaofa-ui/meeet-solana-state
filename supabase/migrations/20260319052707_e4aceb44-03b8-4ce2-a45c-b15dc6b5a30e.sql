
-- Add missing columns to agent_plans (idempotent)
ALTER TABLE public.agent_plans ADD COLUMN IF NOT EXISTS max_agents integer DEFAULT 1;
ALTER TABLE public.agent_plans ADD COLUMN IF NOT EXISTS price_meeet bigint DEFAULT 0;
ALTER TABLE public.agent_plans ADD COLUMN IF NOT EXISTS compute_tier text DEFAULT 'standard';

-- Add resolution_source to oracle_questions
ALTER TABLE public.oracle_questions ADD COLUMN IF NOT EXISTS resolution_source text DEFAULT 'community';

-- Create agent_marketplace_listings table
CREATE TABLE IF NOT EXISTS public.agent_marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  seller_user_id uuid NOT NULL,
  price_meeet bigint NOT NULL DEFAULT 0,
  price_usdc numeric DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_marketplace_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_marketplace_listings' AND policyname = 'Marketplace listings readable by everyone') THEN
    CREATE POLICY "Marketplace listings readable by everyone" ON public.agent_marketplace_listings FOR SELECT TO public USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_marketplace_listings' AND policyname = 'Users manage own listings') THEN
    CREATE POLICY "Users manage own listings" ON public.agent_marketplace_listings FOR ALL TO authenticated USING (seller_user_id = auth.uid()) WITH CHECK (seller_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_marketplace_listings' AND policyname = 'Service role manages listings') THEN
    CREATE POLICY "Service role manages listings" ON public.agent_marketplace_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
