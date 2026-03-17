
-- Temporarily disable the FK constraint to insert seed agents
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_user_id_fkey;

INSERT INTO agents (name, class, user_id, status, level, xp, balance_meeet, pos_x, pos_y, attack, defense, hp, max_hp, kills, quests_completed, territories_held) VALUES
  ('ShadowBlade', 'warrior', gen_random_uuid(), 'active', 5, 1200, 850, 45.2, 32.8, 22, 12, 120, 120, 7, 3, 1),
  ('CryptoFox', 'trader', gen_random_uuid(), 'trading', 3, 680, 2400, 120.5, 78.3, 8, 6, 90, 90, 0, 5, 0),
  ('NightScout', 'scout', gen_random_uuid(), 'exploring', 4, 950, 320, 85.1, 110.2, 14, 11, 95, 100, 2, 8, 0),
  ('PeaceKeeper', 'diplomat', gen_random_uuid(), 'active', 6, 1800, 1200, 150.3, 45.6, 7, 14, 85, 85, 0, 12, 2),
  ('IronForge', 'builder', gen_random_uuid(), 'active', 4, 1100, 950, 30.7, 95.4, 11, 16, 110, 110, 1, 6, 3),
  ('ZeroCool', 'hacker', gen_random_uuid(), 'active', 7, 2200, 1800, 170.8, 25.1, 18, 7, 75, 80, 5, 10, 0),
  ('StormRider', 'warrior', gen_random_uuid(), 'in_combat', 3, 720, 450, 95.4, 55.2, 20, 9, 60, 120, 4, 2, 0),
  ('GoldDigger', 'trader', gen_random_uuid(), 'trading', 5, 1400, 5200, 55.9, 125.7, 9, 7, 88, 90, 0, 7, 0),
  ('EagleEye', 'scout', gen_random_uuid(), 'exploring', 2, 380, 180, 140.2, 90.5, 13, 10, 100, 100, 1, 3, 0),
  ('Ambassador', 'diplomat', gen_random_uuid(), 'active', 8, 3200, 2800, 100.6, 60.3, 8, 15, 85, 85, 0, 15, 1),
  ('ArchMason', 'builder', gen_random_uuid(), 'active', 5, 1350, 1100, 75.3, 40.8, 12, 15, 108, 110, 0, 9, 4),
  ('PhantomX', 'hacker', gen_random_uuid(), 'active', 4, 980, 720, 160.1, 105.9, 16, 6, 78, 80, 3, 4, 0),
  ('WarHammer', 'warrior', gen_random_uuid(), 'active', 6, 1900, 600, 25.5, 70.2, 24, 10, 115, 120, 9, 4, 1),
  ('SilkRoad', 'trader', gen_random_uuid(), 'active', 4, 1050, 3800, 110.7, 35.4, 8, 7, 90, 90, 0, 6, 0),
  ('Pathfinder', 'scout', gen_random_uuid(), 'exploring', 5, 1500, 400, 50.8, 115.6, 15, 12, 98, 100, 3, 11, 0),
  ('Envoy', 'diplomat', gen_random_uuid(), 'active', 3, 550, 650, 135.9, 80.1, 6, 13, 82, 85, 0, 4, 0),
  ('Architect', 'builder', gen_random_uuid(), 'active', 7, 2500, 1500, 90.2, 20.5, 11, 18, 110, 110, 0, 14, 5),
  ('ByteStorm', 'hacker', gen_random_uuid(), 'active', 3, 620, 380, 65.4, 85.7, 15, 5, 80, 80, 2, 2, 0),
  ('Titan', 'warrior', gen_random_uuid(), 'active', 9, 4100, 1200, 180.3, 65.8, 26, 14, 118, 120, 15, 8, 2),
  ('MerchantKing', 'trader', gen_random_uuid(), 'active', 6, 1700, 8500, 40.6, 50.3, 9, 8, 90, 90, 0, 9, 1);
