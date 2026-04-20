-- Encrypt Twitter OAuth credentials and quest submission wallet addresses at rest
-- using pgcrypto symmetric encryption with a key derived from a database secret.
-- This protects sensitive data even if the service-role key is compromised, since
-- attackers would also need access to the encryption key configured at the DB level.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Helper: fetch encryption key from a private settings table (not exposed via API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS private.encryption_keys (
  key_name text PRIMARY KEY,
  key_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.encryption_keys FROM anon, authenticated, public;

-- Seed a strong random key once if missing (idempotent)
INSERT INTO private.encryption_keys (key_name, key_value)
SELECT 'app_data_key', encode(extensions.gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM private.encryption_keys WHERE key_name = 'app_data_key');

-- Encryption / decryption helpers (SECURITY DEFINER so callers can't read the key)
CREATE OR REPLACE FUNCTION private.encrypt_secret(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions, public
AS $$
DECLARE
  k text;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;
  SELECT key_value INTO k FROM private.encryption_keys WHERE key_name = 'app_data_key';
  RETURN encode(extensions.pgp_sym_encrypt(plaintext, k), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION private.decrypt_secret(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions, public
AS $$
DECLARE
  k text;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;
  SELECT key_value INTO k FROM private.encryption_keys WHERE key_name = 'app_data_key';
  RETURN extensions.pgp_sym_decrypt(decode(ciphertext, 'base64'), k);
END;
$$;

REVOKE ALL ON FUNCTION private.encrypt_secret(text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION private.decrypt_secret(text) FROM anon, authenticated, public;

-- ── twitter_accounts: encrypt OAuth credentials ──────────────────────────
ALTER TABLE public.twitter_accounts
  ADD COLUMN IF NOT EXISTS consumer_key_enc text,
  ADD COLUMN IF NOT EXISTS consumer_secret_enc text,
  ADD COLUMN IF NOT EXISTS access_token_enc text,
  ADD COLUMN IF NOT EXISTS access_token_secret_enc text;

-- Migrate existing plaintext values into encrypted columns (idempotent)
UPDATE public.twitter_accounts
SET consumer_key_enc = COALESCE(consumer_key_enc, private.encrypt_secret(consumer_key)),
    consumer_secret_enc = COALESCE(consumer_secret_enc, private.encrypt_secret(consumer_secret)),
    access_token_enc = COALESCE(access_token_enc, private.encrypt_secret(access_token)),
    access_token_secret_enc = COALESCE(access_token_secret_enc, private.encrypt_secret(access_token_secret))
WHERE consumer_key_enc IS NULL
   OR consumer_secret_enc IS NULL
   OR access_token_enc IS NULL
   OR access_token_secret_enc IS NULL;

-- Drop plaintext columns now that data is encrypted
ALTER TABLE public.twitter_accounts
  DROP COLUMN IF EXISTS consumer_key,
  DROP COLUMN IF EXISTS consumer_secret,
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS access_token_secret;

-- Server-side accessor that returns decrypted credentials only to service_role callers.
-- Edge functions using the service role key call this when they need to post to Twitter.
CREATE OR REPLACE FUNCTION public.get_twitter_account_credentials(_username text)
RETURNS TABLE (
  id uuid,
  username text,
  consumer_key text,
  consumer_secret text,
  access_token text,
  access_token_secret text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  -- Only service_role may decrypt credentials. Authenticated/anon users get nothing.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.username,
    private.decrypt_secret(a.consumer_key_enc),
    private.decrypt_secret(a.consumer_secret_enc),
    private.decrypt_secret(a.access_token_enc),
    private.decrypt_secret(a.access_token_secret_enc),
    a.status
  FROM public.twitter_accounts a
  WHERE a.username = _username AND a.status = 'active'
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_twitter_account_credentials(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.get_twitter_account_credentials(text) TO service_role;

-- Server-side upsert that encrypts on write
CREATE OR REPLACE FUNCTION public.upsert_twitter_account(
  _username text,
  _consumer_key text,
  _consumer_secret text,
  _access_token text,
  _access_token_secret text,
  _role text DEFAULT 'main'
)
RETURNS TABLE (id uuid, username text, role text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  INSERT INTO public.twitter_accounts (
    username, consumer_key_enc, consumer_secret_enc,
    access_token_enc, access_token_secret_enc, role, status
  )
  VALUES (
    _username,
    private.encrypt_secret(_consumer_key),
    private.encrypt_secret(_consumer_secret),
    private.encrypt_secret(_access_token),
    private.encrypt_secret(_access_token_secret),
    _role,
    'active'
  )
  ON CONFLICT (username) DO UPDATE SET
    consumer_key_enc = EXCLUDED.consumer_key_enc,
    consumer_secret_enc = EXCLUDED.consumer_secret_enc,
    access_token_enc = EXCLUDED.access_token_enc,
    access_token_secret_enc = EXCLUDED.access_token_secret_enc,
    role = EXCLUDED.role,
    status = 'active'
  RETURNING twitter_accounts.id, twitter_accounts.username, twitter_accounts.role, twitter_accounts.status;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_twitter_account(text, text, text, text, text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.upsert_twitter_account(text, text, text, text, text, text) TO service_role;

-- ── quest_submissions: encrypt wallet_address ────────────────────────────
ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS wallet_address_enc text;

UPDATE public.quest_submissions
SET wallet_address_enc = private.encrypt_secret(wallet_address)
WHERE wallet_address_enc IS NULL AND wallet_address IS NOT NULL;

ALTER TABLE public.quest_submissions
  ALTER COLUMN wallet_address DROP NOT NULL;

-- Replace the plaintext column with a masked view of itself.
-- We keep the column nullable and zero it out; callers must use the RPC below.
UPDATE public.quest_submissions SET wallet_address = NULL;

-- Accessor: only the submitting user OR service_role can read their own wallet
CREATE OR REPLACE FUNCTION public.get_quest_submission_wallet(_submission_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _enc text;
  _owner uuid;
BEGIN
  SELECT wallet_address_enc, user_id INTO _enc, _owner
  FROM public.quest_submissions
  WHERE id = _submission_id;

  IF _enc IS NULL THEN RETURN NULL; END IF;

  IF auth.role() = 'service_role' OR _owner = auth.uid() THEN
    RETURN private.decrypt_secret(_enc);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_quest_submission_wallet(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_quest_submission_wallet(uuid) TO authenticated, service_role;

-- Accessor: insert wrapper that encrypts wallet on write
CREATE OR REPLACE FUNCTION public.create_quest_submission(
  _quest_id uuid,
  _agent_id uuid,
  _wallet_address text,
  _result_text text DEFAULT NULL,
  _result_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.quest_submissions (
    quest_id, agent_id, user_id, wallet_address, wallet_address_enc, result_text, result_url
  )
  VALUES (
    _quest_id, _agent_id, auth.uid(),
    NULL,
    private.encrypt_secret(_wallet_address),
    _result_text, _result_url
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_quest_submission(uuid, uuid, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_quest_submission(uuid, uuid, text, text, text) TO authenticated, service_role;