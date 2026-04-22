
DROP POLICY IF EXISTS "Allow public upvote increment" ON public.agent_proposals;

CREATE OR REPLACE FUNCTION public.increment_proposal_upvote(_proposal_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_count integer;
BEGIN
  UPDATE public.agent_proposals
     SET user_upvotes = user_upvotes + 1
   WHERE id = _proposal_id
   RETURNING user_upvotes INTO _new_count;
  RETURN COALESCE(_new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_proposal_upvote(uuid) TO anon, authenticated;
