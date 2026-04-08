CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discovery_id UUID REFERENCES public.discoveries(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'twitter',
  post_content TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  engagement_metrics JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social posts are publicly readable"
  ON public.social_posts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create social posts"
  ON public.social_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their social posts"
  ON public.social_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX idx_social_posts_status ON public.social_posts(status);
CREATE INDEX idx_social_posts_platform ON public.social_posts(platform);
CREATE INDEX idx_social_posts_created_at ON public.social_posts(created_at DESC);