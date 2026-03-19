
-- Drop the overly permissive public SELECT policy
DROP POLICY "Oracle bets readable by everyone" ON public.oracle_bets;

-- Users can read their own bets
CREATE POLICY "Users read own bets"
  ON public.oracle_bets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
