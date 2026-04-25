-- Fix 1: Prevent email enumeration on newsletter_subscribers.
-- Direct client INSERT allows attackers to probe which emails are subscribed
-- via unique-constraint error responses. Force all subscriptions through the
-- rate-limited edge function (subscribe-newsletter), which uses the service
-- role and returns a generic success response on duplicates.
DROP POLICY IF EXISTS "Anyone can subscribe with valid email" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Users can subscribe with their own email" ON public.newsletter_subscribers;

-- Fix 2: Restrict sector_treasury_log to authenticated users only.
-- The metadata jsonb column may contain operational details; remove anonymous read.
DROP POLICY IF EXISTS "Treasury log public read" ON public.sector_treasury_log;

CREATE POLICY "Authenticated users can read treasury log"
ON public.sector_treasury_log
FOR SELECT
TO authenticated
USING (true);