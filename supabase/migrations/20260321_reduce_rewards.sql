-- Reduce all open quest rewards by 5x to ensure treasury sustainability
UPDATE quests 
SET reward_meeet = GREATEST(50, reward_meeet / 5),
    reward_sol = ROUND(CAST(reward_sol / 5 AS numeric), 3)
WHERE status = 'open';
