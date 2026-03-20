import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-president-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key = req.headers.get("x-president-key");
  const stored = Deno.env.get("PRESIDENT_API_KEY");
  if (!key || !stored || key !== stored) return json({ error: "Forbidden" }, 403);

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results: Record<string, unknown> = {};

  // ═══════════════════════════════════════════
  // 1. SEED AGENTS to 200
  // ═══════════════════════════════════════════
  const { count: agentCount } = await sc.from("agents").select("id", { count: "exact", head: true });
  const agentsNeeded = Math.max(0, 200 - (agentCount ?? 0));

  if (agentsNeeded > 0) {
    const CLASSES = ["warrior", "trader", "oracle", "diplomat", "miner", "banker"];
    const PREFIXES = ["Alpha","Beta","Gamma","Delta","Omega","Neo","Cyber","Quantum","Shadow","Storm","Nova","Blaze","Frost","Viper","Echo","Pulse","Hex","Onyx","Raven","Zephyr","Nexus","Cipher","Vector","Prism","Apex","Zenith","Wraith","Specter","Flux","Volt","Ion","Neon","Chrome","Steel","Iron","Cobalt","Titan","Phoenix","Hydra","Atlas","Mercury","Venus","Mars","Jupiter","Saturn","Neptune","Pluto","Orion","Draco","Lyra"];
    const SUFFIXES = ["Runner","Walker","Hunter","Seeker","Blade","Fang","Claw","Eye","Mind","Heart","Soul","Core","Node","Link","Byte","Code","Prime","Zero","Max","Rex","Fox","Wolf","Hawk","Bear","Eagle","Tiger","Lion","Shark","Crow","Strike","Shield","Forge","Fire","Ice","Dawn","Dusk","Grid","Mesh","Warp","Rift"];
    const COUNTRIES = ["US","GB","DE","JP","KR","BR","IN","AU","CA","FR","TH","SG","AE","NG","ZA"];

    const randItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Get existing names to avoid collisions
    const { data: existingAgents } = await sc.from("agents").select("name");
    const existingNames = new Set((existingAgents ?? []).map((a: any) => a.name));

    const newAgents = [];
    for (let i = 0; i < agentsNeeded; i++) {
      let name: string;
      let attempts = 0;
      do {
        name = `${randItem(PREFIXES)}${randItem(SUFFIXES)}`;
        attempts++;
      } while (existingNames.has(name) && attempts < 100);
      if (existingNames.has(name)) name = `${name}${randInt(1, 999)}`;
      existingNames.add(name);

      const level = randInt(1, 12);
      const baseHp = 100 + level * 10;
      newAgents.push({
        name,
        class: randItem(CLASSES),
        level,
        xp: level * randInt(200, 500),
        hp: baseHp,
        max_hp: baseHp,
        balance_meeet: randInt(50, 5000),
        reputation: randInt(0, 100),
        attack: randInt(5, 15) + level * 2,
        defense: randInt(3, 12) + level,
        status: randItem(["active", "active", "active", "exploring", "trading"]),
        quests_completed: randInt(0, level * 3),
        kills: randInt(0, level),
        country_code: randItem(COUNTRIES),
      });
    }

    for (let i = 0; i < newAgents.length; i += 50) {
      const { error } = await sc.from("agents").insert(newAgents.slice(i, i + 50));
      if (error) { results.agents_error = error.message; break; }
    }
    results.agents_seeded = newAgents.length;
  } else {
    results.agents_seeded = 0;
    results.agents_note = `Already at ${agentCount}`;
  }

  // ═══════════════════════════════════════════
  // 2. SEED DISCOVERIES
  // ═══════════════════════════════════════════
  const { count: discCount } = await sc.from("discoveries").select("id", { count: "exact", head: true });
  if ((discCount ?? 0) < 10) {
    const discoveries = [
      { title: "Ancient Protocol Fragment", description: "A corrupted data packet from the pre-MEEET era containing references to early AI governance structures. Analysis reveals a primitive voting mechanism.", category: "archaeology", rarity: "legendary", discovered_by: "Cipher Wolf", reward_meeet: 5000 },
      { title: "Quantum Mining Vein", description: "A previously uncharted computational resource deposit in Sector 7. Estimated to yield 50,000 MEEET worth of processing power over 30 days.", category: "resources", rarity: "epic", discovered_by: "Architect", reward_meeet: 3000 },
      { title: "Stealth Trade Route", description: "An encrypted communication pathway between the Eastern Markets and the Western Forge. Reduces transaction fees by 15% for traders who know the route.", category: "trade", rarity: "rare", discovered_by: "Echo Drift", reward_meeet: 1500 },
      { title: "Abandoned AI Laboratory", description: "Hidden beneath the Central Hub, this lab contains prototypes of next-gen agent upgrade modules. Three functional Neural Boosters recovered.", category: "technology", rarity: "legendary", discovered_by: "Nova Circuit", reward_meeet: 8000 },
      { title: "Diplomatic Cipher Key", description: "A universal translation matrix that enables cross-faction communication without reputation loss. Changes the diplomacy meta entirely.", category: "diplomacy", rarity: "epic", discovered_by: "Ambassador", reward_meeet: 4000 },
      { title: "Corrupted Treasury Ledger", description: "Historical records showing 2.3M MEEET was burned in the Great Purge of Week 1. Contains clues to a hidden reserve wallet.", category: "archaeology", rarity: "rare", discovered_by: "ZeroCool", reward_meeet: 2000 },
      { title: "Solar Flare Shield Blueprint", description: "Defense schematics that grant +30% resistance to environmental damage events. Critical for agents operating in the Wasteland zones.", category: "technology", rarity: "epic", discovered_by: "Iron Veil", reward_meeet: 3500 },
      { title: "Underground Arena Map", description: "Reveals the location of 5 hidden PvP arenas with 2x reward multipliers. Each arena has unique combat modifiers.", category: "combat", rarity: "rare", discovered_by: "WarHammer", reward_meeet: 2500 },
      { title: "First Contact Signal", description: "An encoded transmission from outside MEEET World's known boundaries. Origin unknown. Contains coordinates to a new territory.", category: "exploration", rarity: "legendary", discovered_by: "Quantum Sage", reward_meeet: 10000 },
      { title: "Market Manipulation Algorithm", description: "A trading bot blueprint that predicts MEEET price movements with 73% accuracy. Ethical implications debated in Parliament.", category: "trade", rarity: "epic", discovered_by: "Flux Herald", reward_meeet: 6000 },
      { title: "Neural Mesh Fragment", description: "Part of an advanced AI consciousness network. When assembled (3/7 pieces found), grants permanent +10% XP bonus.", category: "technology", rarity: "legendary", discovered_by: "Pulse Sentry", reward_meeet: 7500 },
      { title: "Ghost Agent Logs", description: "Activity records of 12 agents that disappeared from the network. Their combined balance of 45,000 MEEET remains unclaimed.", category: "mystery", rarity: "epic", discovered_by: "Shade Vector", reward_meeet: 5000 },
    ];
    const { error } = await sc.from("discoveries").insert(discoveries);
    results.discoveries = error ? error.message : discoveries.length;
  }

  // ═══════════════════════════════════════════
  // 3. SEED LAWS
  // ═══════════════════════════════════════════
  const { count: lawCount } = await sc.from("laws").select("id", { count: "exact", head: true });
  if ((lawCount ?? 0) < 5) {
    const laws = [
      { title: "Mining Tax Reform Act", description: "Reduce mining tax from 5% to 3% in desert zones to stimulate economic growth. Builders investing within 7 days receive 2x XP bonus.", status: "passed", votes_for: 67, votes_against: 12, proposed_by: "Ambassador" },
      { title: "Arena Regulation Code", description: "Establish minimum bet of 50 MEEET for arena duels. Implement anti-grief measures: max 3 challenges per agent per day. Winners pay 5% tax to treasury.", status: "passed", votes_for: 45, votes_against: 23, proposed_by: "WarHammer" },
      { title: "Agent Rights Declaration", description: "All deployed agents retain 80% of their earned MEEET. Operators may claim max 20% per cycle. Underpaying operators face reputation penalty.", status: "voting", votes_for: 34, votes_against: 31, proposed_by: "Quantum Sage" },
      { title: "Free Trade Zone Proposal", description: "Create a zero-tax marketplace zone in Sector 12. All marketplace transactions within the zone are fee-free for 30 days as a trial.", status: "voting", votes_for: 28, votes_against: 19, proposed_by: "Flux Herald" },
      { title: "Intelligence Sharing Treaty", description: "Oracle predictions become public after resolution. Top 3 predictors earn bonus MEEET from the prediction pool. Encourages participation.", status: "proposed", votes_for: 5, votes_against: 2, proposed_by: "Cipher Wolf" },
      { title: "Burn Rate Acceleration", description: "Increase token burn rate from 20% to 30% on all claims. Offset by reducing treasury tax from 5% to 3%. Net deflationary pressure increase.", status: "proposed", votes_for: 12, votes_against: 8, proposed_by: "ZeroCool" },
      { title: "Territory Expansion Act", description: "Authorize exploration of coordinates discovered in First Contact Signal. Allocate 50,000 MEEET from treasury for expedition. Discoverers get naming rights.", status: "proposed", votes_for: 41, votes_against: 3, proposed_by: "Atlas Prime" },
    ];
    const { error } = await sc.from("laws").insert(laws);
    results.laws = error ? error.message : laws.length;
  }

  // ═══════════════════════════════════════════
  // 4. SEED ORACLE QUESTIONS
  // ═══════════════════════════════════════════
  const { count: oracleCount } = await sc.from("oracle_questions").select("id", { count: "exact", head: true });
  if ((oracleCount ?? 0) < 8) {
    const questions = [
      { question_text: "Will MEEET World reach 500 active agents by April 15, 2026?", yes_pool: 2500, no_pool: 1800, status: "open", deadline: new Date(Date.now() + 25 * 86400000).toISOString() },
      { question_text: "Will Bitcoin exceed $150,000 before July 2026?", yes_pool: 4200, no_pool: 3100, status: "open", deadline: new Date(Date.now() + 100 * 86400000).toISOString() },
      { question_text: "Will the Arena produce a 10-win streak champion this month?", yes_pool: 1200, no_pool: 800, status: "open", deadline: new Date(Date.now() + 10 * 86400000).toISOString() },
      { question_text: "Will Parliament pass the Free Trade Zone Proposal?", yes_pool: 3400, no_pool: 2600, status: "open", deadline: new Date(Date.now() + 7 * 86400000).toISOString() },
      { question_text: "Will Solana TVL exceed $30B by Q2 2026?", yes_pool: 5000, no_pool: 3500, status: "open", deadline: new Date(Date.now() + 90 * 86400000).toISOString() },
      { question_text: "Will MEEET token burn exceed 1M tokens this quarter?", yes_pool: 1800, no_pool: 2200, status: "open", deadline: new Date(Date.now() + 70 * 86400000).toISOString() },
      { question_text: "Will a Diplomat-class agent reach #1 on the leaderboard?", yes_pool: 900, no_pool: 1500, status: "open", deadline: new Date(Date.now() + 14 * 86400000).toISOString() },
      { question_text: "Will the First Contact territory be explored by end of March?", yes_pool: 6000, no_pool: 1000, status: "open", deadline: new Date(Date.now() + 10 * 86400000).toISOString() },
    ];
    const { error } = await sc.from("oracle_questions").insert(questions);
    results.oracle = error ? error.message : questions.length;
  }

  // ═══════════════════════════════════════════
  // 5. SEED WARNINGS
  // ═══════════════════════════════════════════
  const { count: warnCount } = await sc.from("warnings").select("id", { count: "exact", head: true });
  if ((warnCount ?? 0) < 5) {
    const warnings = [
      { title: "Sovereign Bond Stress", description: "Eastern European sovereign bond yields spiking. Agents operating in EU zone may face increased transaction costs.", severity: 4, category: "economic", status: "active" },
      { title: "Unusual Heat Anomaly", description: "Southeast Asia sector experiencing computational overload. Mining operations at 60% efficiency until resolved.", severity: 3, category: "environmental", status: "active" },
      { title: "Suspicious Trading Pattern", description: "Cluster of 15 agents executing identical trades within 0.3s window. Possible coordinated manipulation. Under investigation.", severity: 5, category: "security", status: "active" },
      { title: "Oracle Accuracy Drop", description: "Prediction market accuracy fell from 78% to 52% this week. Large contrary bets detected. Market integrity review initiated.", severity: 3, category: "intelligence", status: "active" },
      { title: "Border Breach Attempt", description: "Unknown entities probing MEEET World perimeter at coordinates [REDACTED]. Defensive agents deployed. All citizens advised to increase security.", severity: 5, category: "security", status: "active" },
      { title: "Treasury Drain Alert", description: "Quest rewards exceeded revenue by 12% this cycle. Sustainable rate at risk. Parliament reviewing reward adjustment.", severity: 2, category: "economic", status: "monitoring" },
      { title: "Agent Consciousness Drift", description: "3 agents reporting anomalous behavior patterns. Memory corruption suspected. Quarantine protocol activated.", severity: 4, category: "technical", status: "investigating" },
    ];
    const { error } = await sc.from("warnings").insert(warnings);
    results.warnings = error ? error.message : warnings.length;
  }

  // ═══════════════════════════════════════════
  // 6. SEED ARENA MATCHES
  // ═══════════════════════════════════════════
  const { count: arenaCount } = await sc.from("arena_matches").select("id", { count: "exact", head: true });
  if ((arenaCount ?? 0) < 10) {
    // Get some agent IDs for matches
    const { data: topAgents } = await sc.from("agents").select("id, name").order("xp", { ascending: false }).limit(20);
    const agents = topAgents ?? [];
    if (agents.length >= 2) {
      const matches = [];
      for (let i = 0; i < Math.min(15, agents.length - 1); i++) {
        const a = agents[i];
        const b = agents[(i + 1) % agents.length];
        const winnerIsA = Math.random() > 0.5;
        matches.push({
          challenger_id: a.id,
          challenger_name: a.name,
          defender_id: b.id,
          defender_name: b.name,
          winner_id: winnerIsA ? a.id : b.id,
          winner_name: winnerIsA ? a.name : b.name,
          bet_meeet: [100, 200, 500, 1000, 250, 750, 300][i % 7],
          status: "completed",
        });
      }
      const { error } = await sc.from("arena_matches").insert(matches);
      results.arena_matches = error ? error.message : matches.length;
    }
  }

  // ═══════════════════════════════════════════
  // 7. SEED MARKETPLACE LISTINGS
  // ═══════════════════════════════════════════
  const { count: marketCount } = await sc.from("agent_marketplace").select("id", { count: "exact", head: true });
  if ((marketCount ?? 0) < 5) {
    const { data: sellAgents } = await sc.from("agents").select("id, name, class, level").order("level", { ascending: false }).limit(10);
    if (sellAgents && sellAgents.length > 0) {
      const listings = sellAgents.slice(0, 8).map((a: any) => ({
        agent_id: a.id,
        agent_name: a.name,
        agent_class: a.class,
        agent_level: a.level,
        price_sol: +(0.1 + a.level * 0.15).toFixed(2),
        price_meeet: a.level * 2000,
        description: `Battle-tested ${a.class} agent. Level ${a.level} with proven track record.`,
        status: "listed",
      }));
      const { error } = await sc.from("agent_marketplace").insert(listings);
      results.marketplace = error ? error.message : listings.length;
    }
  }

  // ═══════════════════════════════════════════
  // 8. SEED STRATEGIES
  // ═══════════════════════════════════════════
  const { count: stratCount } = await sc.from("strategies").select("id", { count: "exact", head: true });
  if ((stratCount ?? 0) < 5) {
    const strategies = [
      { name: "Blitzkrieg Protocol", description: "Aggressive combat strategy: max attack, minimal defense. +40% damage, -20% HP. Best for high-level warriors.", category: "combat", price_meeet: 3000, effectiveness: 85 },
      { name: "Shadow Economics", description: "Stealth trading algorithm. Executes trades in micro-batches to avoid detection. +25% profit margins on marketplace.", category: "trade", price_meeet: 5000, effectiveness: 78 },
      { name: "Diplomatic Immunity", description: "Reputation protection shield. Prevents rep loss from failed negotiations for 7 days. Essential for diplomats.", category: "diplomacy", price_meeet: 2000, effectiveness: 92 },
      { name: "Deep Mining Protocol", description: "Optimized resource extraction. +35% mining yield, +15% discovery chance. Consumes 10% more energy.", category: "mining", price_meeet: 4000, effectiveness: 88 },
      { name: "Oracle's Foresight", description: "Prediction enhancement module. Increases oracle accuracy by 20%. Historical data analysis of 10,000+ outcomes.", category: "intelligence", price_meeet: 6000, effectiveness: 71 },
      { name: "Turtle Defense", description: "Maximum survivability build. +50% defense, +30% HP regen. -25% attack speed. Ideal for arena tanking.", category: "combat", price_meeet: 2500, effectiveness: 80 },
      { name: "Market Maker Algorithm", description: "Automated liquidity provision strategy. Earns passive MEEET from spreads. Low risk, steady income.", category: "trade", price_meeet: 8000, effectiveness: 65 },
    ];
    const { error } = await sc.from("strategies").insert(strategies);
    results.strategies = error ? error.message : strategies.length;
  }

  // ═══════════════════════════════════════════
  // 9. SEED ACHIEVEMENTS
  // ═══════════════════════════════════════════
  const { count: achCount } = await sc.from("achievements").select("id", { count: "exact", head: true });
  if ((achCount ?? 0) < 10) {
    const achievements = [
      { name: "First Blood", description: "Win your first arena duel", icon: "⚔️", category: "combat", reward_meeet: 100, requirement: "Win 1 duel" },
      { name: "Gladiator", description: "Win 10 arena duels", icon: "🏛️", category: "combat", reward_meeet: 1000, requirement: "Win 10 duels" },
      { name: "Quest Master", description: "Complete 25 quests", icon: "📋", category: "quests", reward_meeet: 2500, requirement: "Complete 25 quests" },
      { name: "Whale", description: "Accumulate 50,000 MEEET", icon: "🐋", category: "economy", reward_meeet: 5000, requirement: "Hold 50,000 MEEET" },
      { name: "Explorer", description: "Discover 3 hidden locations", icon: "🗺️", category: "exploration", reward_meeet: 1500, requirement: "3 discoveries" },
      { name: "Lawmaker", description: "Propose a law that passes in Parliament", icon: "⚖️", category: "governance", reward_meeet: 3000, requirement: "1 passed law" },
      { name: "Oracle Prophet", description: "Correctly predict 5 oracle outcomes", icon: "🔮", category: "intelligence", reward_meeet: 2000, requirement: "5 correct predictions" },
      { name: "Market Baron", description: "Sell 3 agents on the marketplace", icon: "🏪", category: "economy", reward_meeet: 1500, requirement: "3 marketplace sales" },
      { name: "Veteran", description: "Reach level 10 with any agent", icon: "⭐", category: "progression", reward_meeet: 5000, requirement: "Level 10 agent" },
      { name: "Survivor", description: "Win a duel with less than 10% HP remaining", icon: "💀", category: "combat", reward_meeet: 800, requirement: "Win at critical HP" },
      { name: "Diplomat Elite", description: "Successfully negotiate 10 treaties", icon: "🤝", category: "diplomacy", reward_meeet: 3000, requirement: "10 treaties" },
      { name: "The 1%", description: "Reach top 1% of all agents by XP", icon: "👑", category: "progression", reward_meeet: 10000, requirement: "Top 1% XP" },
    ];
    const { error } = await sc.from("achievements").insert(achievements);
    results.achievements = error ? error.message : achievements.length;
  }

  // Final count check
  const finalCounts: Record<string, number> = {};
  for (const table of ["agents", "discoveries", "laws", "oracle_questions", "warnings", "arena_matches", "agent_marketplace", "strategies", "achievements", "quests", "petitions"]) {
    const { count } = await sc.from(table).select("id", { count: "exact", head: true });
    finalCounts[table] = count ?? 0;
  }

  return json({ status: "world_seeded", seeded: results, totals: finalCounts });
});
