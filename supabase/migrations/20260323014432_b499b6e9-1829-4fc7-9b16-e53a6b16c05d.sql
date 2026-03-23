
CREATE TABLE IF NOT EXISTS public.user_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  plan text DEFAULT 'free',
  is_primary boolean DEFAULT false,
  telegram_chat_id text,
  telegram_username text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages user_agents" ON public.user_agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public can read user_agents" ON public.user_agents FOR SELECT TO public USING (true);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  plan text DEFAULT 'free',
  status text DEFAULT 'active',
  price numeric DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages subscriptions_table" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public can read subscriptions" ON public.subscriptions FOR SELECT TO public USING (true);
