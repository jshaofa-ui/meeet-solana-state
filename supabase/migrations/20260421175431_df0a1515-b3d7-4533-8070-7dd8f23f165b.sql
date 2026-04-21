ALTER TABLE public.agent_interactions REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_interactions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;