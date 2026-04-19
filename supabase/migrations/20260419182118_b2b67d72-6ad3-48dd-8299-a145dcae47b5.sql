-- 1) Newsletter: ограничиваем INSERT email-ом текущего пользователя
DROP POLICY IF EXISTS "Authenticated users can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Users can subscribe with their own email"
ON public.newsletter_subscribers
FOR INSERT
TO authenticated
WITH CHECK (
  lower(email) = lower(coalesce((auth.jwt() ->> 'email')::text, ''))
);

-- 2) Stakes: убираем публичный доступ ко всем колонкам
DROP POLICY IF EXISTS "Public read stakes" ON public.stakes;
CREATE POLICY "Owners can read their stakes"
ON public.stakes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = stakes.agent_id AND a.user_id = auth.uid()
  )
);

-- 3) Reviews: убираем анонимный доступ к полным записям
DROP POLICY IF EXISTS "Public can read review counts" ON public.reviews;
CREATE POLICY "Authenticated can read reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (true);
