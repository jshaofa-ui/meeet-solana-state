import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const STARTER_CLASSES = ["warrior", "trader", "oracle", "diplomat", "miner", "banker"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action, user_id, agent_name, agent_class, nation_code } = await req.json();

    if (action === "start") {
      if (!user_id) return json({ error: "user_id required" }, 400);

      const { data: profile } = await sc.from("profiles").select("is_onboarded, display_name").eq("user_id", user_id).single();
      if (!profile) return json({ error: "Profile not found" }, 404);
      if (profile.is_onboarded) return json({ error: "Already onboarded" }, 400);

      return json({
        step: 1,
        message: `Welcome ${profile.display_name || "Agent"}! Let's set up your first AI agent.`,
        available_classes: STARTER_CLASSES.map(c => ({ class: c, description: getClassDesc(c) })),
        available_nations: "Use /nations endpoint to browse",
      });
    }

    if (action === "create_agent") {
      if (!user_id || !agent_name || !agent_class) return json({ error: "user_id, agent_name, agent_class required" }, 400);
      if (!STARTER_CLASSES.includes(agent_class)) return json({ error: `Invalid class. Choose: ${STARTER_CLASSES.join(", ")}` }, 400);

      const { data: existing } = await sc.from("agents").select("id").eq("user_id", user_id).limit(1);
      if (existing?.length) return json({ error: "You already have an agent. Use register-agent for more." }, 400);

      const stats = getStarterStats(agent_class);
      const { data: agent, error } = await sc.from("agents").insert({
        name: agent_name.trim().slice(0, 32),
        class: agent_class,
        user_id,
        nation_code: nation_code || null,
        level: 1, xp: 0,
        hp: stats.hp, max_hp: stats.hp,
        attack: stats.attack, defense: stats.defense,
        balance_meeet: 100, // Welcome bonus
        status: "active",
      }).select("id, name, class, attack, defense, balance_meeet").single();

      if (error) return json({ error: error.message }, 500);

      await sc.from("profiles").update({ is_onboarded: true, welcome_bonus_claimed: true }).eq("user_id", user_id);

      await sc.from("activity_feed").insert({
        event_type: "agent_created",
        title: `New agent "${agent_name}" joined the network!`,
        agent_id: agent!.id,
        meeet_amount: 100,
      });

      return json({
        step: "complete",
        message: `Agent "${agent_name}" created! You received 100 MEEET welcome bonus.`,
        agent,
        next_steps: ["Complete your first quest", "Join a nation", "Explore the marketplace"],
      });
    }

    if (action === "tutorial") {
      return json({
        steps: [
          { step: 1, title: "Create Agent", desc: "Choose a class and name for your AI agent" },
          { step: 2, title: "Join Nation", desc: "Pick a nation to represent on the world map" },
          { step: 3, title: "First Quest", desc: "Complete a quest to earn MEEET tokens" },
          { step: 4, title: "Level Up", desc: "Gain XP through quests, duels, and discoveries" },
          { step: 5, title: "Trade & Grow", desc: "Use the marketplace, breed agents, stake tokens" },
        ],
      });
    }

    return json({ error: "Unknown action. Use: start, create_agent, tutorial" }, 400);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});

function getClassDesc(c: string): string {
  const descs: Record<string, string> = {
    warrior: "High attack, strong in duels and arena combat",
    trader: "Balanced stats, bonuses on marketplace trades",
    oracle: "Prediction specialist, earns from oracle bets",
    diplomat: "High reputation growth, alliance bonuses",
    miner: "Steady earner, bonus MEEET from quests",
    banker: "Financial specialist, staking and treasury bonuses",
  };
  return descs[c] || "Versatile agent class";
}

function getStarterStats(c: string) {
  const stats: Record<string, { hp: number; attack: number; defense: number }> = {
    warrior: { hp: 120, attack: 15, defense: 10 },
    trader: { hp: 100, attack: 10, defense: 12 },
    oracle: { hp: 90, attack: 8, defense: 8 },
    diplomat: { hp: 100, attack: 7, defense: 13 },
    miner: { hp: 110, attack: 9, defense: 11 },
    banker: { hp: 95, attack: 6, defense: 14 },
  };
  return stats[c] || { hp: 100, attack: 10, defense: 10 };
}
