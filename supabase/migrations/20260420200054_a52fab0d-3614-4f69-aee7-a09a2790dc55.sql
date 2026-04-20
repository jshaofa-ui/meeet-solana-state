-- 1) user_bots: add owner-scoped SELECT policy and lock down sensitive columns
-- Owners can SELECT their own row, but column grants exclude bot_token/webhook_secret.
CREATE POLICY "Owners can view own bot row"
ON public.user_bots
FOR SELECT
TO authenticated
USING (user_id = (auth.uid())::text);

-- Revoke any broad table grants then re-grant only safe columns to authenticated.
REVOKE ALL ON public.user_bots FROM authenticated;
GRANT SELECT (id, user_id, agent_id, bot_username, bot_name, status, created_at, updated_at)
  ON public.user_bots TO authenticated;

-- 2) quest_submissions: prevent users from writing plaintext wallet_address.
-- Force plaintext column to NULL on any client INSERT/UPDATE; only the
-- create_quest_submission() SECURITY DEFINER function may set wallet_address_enc.
CREATE OR REPLACE FUNCTION public.quest_submissions_block_wallet_plaintext()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only service_role may set plaintext or encrypted wallet directly.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.wallet_address := NULL;
    -- Preserve existing encrypted value on UPDATE; block changes from clients.
    IF TG_OP = 'UPDATE' THEN
      NEW.wallet_address_enc := OLD.wallet_address_enc;
    ELSE
      NEW.wallet_address_enc := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_submissions_block_wallet ON public.quest_submissions;
CREATE TRIGGER trg_quest_submissions_block_wallet
BEFORE INSERT OR UPDATE ON public.quest_submissions
FOR EACH ROW
EXECUTE FUNCTION public.quest_submissions_block_wallet_plaintext();

-- Scrub any historical plaintext wallets that snuck into the table.
UPDATE public.quest_submissions
SET wallet_address = NULL
WHERE wallet_address IS NOT NULL;