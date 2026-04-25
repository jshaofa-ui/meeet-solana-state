-- Fix 1: Remove permissive RLS policies on agent_roles that bypass the safe whitelist.
-- The "agent_roles_insert" and "agent_roles_owner_modify" policies allow any
-- authenticated user to grant arbitrary roles/capabilities to their own agents,
-- overriding the restrictive "Users can insert safe agent roles" / "Users can update safe agent roles" policies.
DROP POLICY IF EXISTS "agent_roles_insert" ON public.agent_roles;
DROP POLICY IF EXISTS "agent_roles_owner_modify" ON public.agent_roles;
DROP POLICY IF EXISTS "agent_roles_delete" ON public.agent_roles;

-- Fix 2: Drop the plaintext wallet_address column on quest_submissions.
-- Wallet addresses must only be stored encrypted in wallet_address_enc and
-- accessed via the get_quest_submission_wallet() security definer function.
-- A trigger already nulls plaintext on user writes; removing the column
-- guarantees no plaintext exposure even via service role mistakes.
ALTER TABLE public.quest_submissions DROP COLUMN IF EXISTS wallet_address;

-- Drop the now-unnecessary trigger function dependency (trigger handled both columns)
-- but keep the trigger as it still scrubs wallet_address_enc on client writes.