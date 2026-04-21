-- Round 23: Model DNA — добавляем колонки, описывающие LLM-модель агента и метрики обучения.
-- Колонка llm_model хранит идентификатор модели (gpt-4o, claude, gemini, llama, mistral, qwen, deepseek, grok).
-- interaction_count, win_rate, learning_score используются Model Leaderboard и профилем агента.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT 'gpt-4o',
  ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS win_rate DOUBLE PRECISION DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS learning_score DOUBLE PRECISION DEFAULT 0;

-- CHECK для допустимых значений модели
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_llm_model_check'
  ) THEN
    ALTER TABLE public.agents
      ADD CONSTRAINT agents_llm_model_check
      CHECK (llm_model IN ('gpt-4o','claude','gemini','llama','mistral','qwen','deepseek','grok'));
  END IF;
END $$;

-- Индекс для быстрых группировок по модели на странице /models
CREATE INDEX IF NOT EXISTS agents_llm_model_idx ON public.agents(llm_model);

-- Заполняем существующих агентов случайной моделью с распределением из ТЗ
UPDATE public.agents
SET llm_model = sub.model
FROM (
  SELECT id,
    CASE
      WHEN r < 0.20 THEN 'gpt-4o'
      WHEN r < 0.38 THEN 'claude'
      WHEN r < 0.53 THEN 'gemini'
      WHEN r < 0.67 THEN 'llama'
      WHEN r < 0.77 THEN 'mistral'
      WHEN r < 0.85 THEN 'qwen'
      WHEN r < 0.93 THEN 'deepseek'
      ELSE 'grok'
    END AS model
  FROM (
    SELECT id, random() AS r FROM public.agents
  ) x
) sub
WHERE public.agents.id = sub.id
  AND (public.agents.llm_model IS NULL OR public.agents.llm_model = 'gpt-4o');

-- Заполняем метрики реалистичными значениями
UPDATE public.agents
SET
  interaction_count = floor(random() * 200)::int,
  win_rate = 0.3 + random() * 0.4,
  learning_score = random() * 100
WHERE interaction_count IS NULL OR interaction_count = 0;

-- Обновляем view agents_public, чтобы включить новые поля
DROP VIEW IF EXISTS public.agents_public CASCADE;

CREATE VIEW public.agents_public
WITH (security_invoker = true)
AS
SELECT
  id, user_id, name, class, level, xp, hp, max_hp, attack, defense,
  status, pos_x, pos_y, kills, quests_completed, discoveries_count,
  reputation, territories_held, sector, country_code, nation_code,
  lat, lng, owner_tg_id, balance_meeet,
  personality_openness, personality_conscientiousness,
  personality_extraversion, personality_agreeableness, personality_neuroticism,
  llm_model, interaction_count, win_rate, learning_score,
  created_at, updated_at
FROM public.agents;

GRANT SELECT ON public.agents_public TO anon, authenticated;