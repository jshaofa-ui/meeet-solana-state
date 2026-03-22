import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action, agent_id, query, domain, discovery_id } = await req.json();

    if (action === "search") {
      if (!agent_id || !query) return json({ error: "agent_id and query required" }, 400);
      const { data: agent } = await sc.from("agents").select("id, name, class, level").eq("id", agent_id).single();
      if (!agent) return json({ error: "Agent not found" }, 404);

      const { data: discoveries } = await sc.from("discoveries")
        .select("id, title, domain, impact_score, synthesis_text, created_at")
        .or(`title.ilike.%${query}%,synthesis_text.ilike.%${query}%`)
        .order("impact_score", { ascending: false })
        .limit(10);

      return json({ agent: agent.name, query, results: discoveries ?? [], count: discoveries?.length ?? 0 });
    }

    if (action === "summarize") {
      if (!discovery_id) return json({ error: "discovery_id required" }, 400);
      const { data: disc } = await sc.from("discoveries").select("title, synthesis_text, domain, impact_score, proposed_steps").eq("id", discovery_id).single();
      if (!disc) return json({ error: "Discovery not found" }, 404);

      return json({
        title: disc.title,
        domain: disc.domain,
        impact: disc.impact_score,
        summary: disc.synthesis_text?.slice(0, 500) || "No synthesis available",
        next_steps: disc.proposed_steps || "No proposed steps",
      });
    }

    if (action === "recommend") {
      if (!agent_id) return json({ error: "agent_id required" }, 400);
      const { data: agent } = await sc.from("agents").select("class, nation_code").eq("id", agent_id).single();
      if (!agent) return json({ error: "Agent not found" }, 404);

      const { data: discoveries } = await sc.from("discoveries")
        .select("id, title, domain, impact_score")
        .eq("is_approved", true)
        .order("impact_score", { ascending: false })
        .limit(5);

      const { data: quests } = await sc.from("quests")
        .select("id, title, category, reward_meeet, reward_sol")
        .eq("status", "open")
        .order("reward_meeet", { ascending: false })
        .limit(5);

      return json({ recommended_discoveries: discoveries ?? [], recommended_quests: quests ?? [] });
    }

    if (action === "cite") {
      if (!discovery_id || !agent_id) return json({ error: "discovery_id and agent_id required" }, 400);
      const { data: disc } = await sc.from("discoveries").select("id, title, upvotes, is_cited").eq("id", discovery_id).single();
      if (!disc) return json({ error: "Discovery not found" }, 404);

      await sc.from("discoveries").update({ is_cited: true, upvotes: disc.upvotes + 1 }).eq("id", discovery_id);

      return json({ status: "cited", discovery: disc.title, new_upvotes: disc.upvotes + 1 });
    }

    return json({ error: "Unknown action. Use: search, summarize, recommend, cite" }, 400);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});
