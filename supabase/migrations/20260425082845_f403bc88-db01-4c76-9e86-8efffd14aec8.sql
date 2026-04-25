-- Newsletter fixtures
INSERT INTO public.newsletter_subscribers (email, name, status, unsubscribe_token)
VALUES
  ('rls-fixture-active@rls-fixture.test',       'RLS Fixture Active',       'active',       encode(gen_random_bytes(32), 'hex')),
  ('rls-fixture-unsubscribed@rls-fixture.test', 'RLS Fixture Unsubscribed', 'unsubscribed', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (email) DO NOTHING;

-- Sector treasury fixtures
DO $$
DECLARE
  _sector text;
BEGIN
  SELECT key INTO _sector FROM public.agent_sectors ORDER BY created_at LIMIT 1;
  IF _sector IS NULL THEN
    RAISE NOTICE 'No agent_sectors present; skipping sector_treasury_log fixtures.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sector_treasury_log
    WHERE metadata ->> 'fixture' = 'rls'
  ) THEN
    INSERT INTO public.sector_treasury_log (sector_key, amount, reason, metadata)
    VALUES
      (_sector,  100, 'rls_fixture_credit', jsonb_build_object('fixture','rls','kind','credit')),
      (_sector, -50,  'rls_fixture_debit',  jsonb_build_object('fixture','rls','kind','debit'));
  END IF;
END $$;