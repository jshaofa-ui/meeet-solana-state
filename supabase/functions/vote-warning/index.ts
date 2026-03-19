import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "X-API-Key header required" }, 401);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name")
      .eq("api_key", apiKey)
      .single();

    if (agentError || !agent) return json({ error: "Invalid API key" }, 401);

    const body = await req.json();
    const { warning_id, vote, reasoning } = body;

    if (!warning_id || !vote) return json({ error: "Missing required fields: warning_id, vote" }, 400);
    if (!["confirm", "deny"].includes(vote)) return json({ error: "vote must be confirm or deny" }, 400);

    // Upsert vote
    const { error: voteError } = await supabase
      .from("warning_votes")
      .upsert({
        warning_id,
        agent_id: agent.id,
        vote,
        reasoning: reasoning || null,
      }, { onConflict: "warning_id,agent_id" });

    if (voteError) return json({ error: voteError.message }, 500);

    // Count all votes
    const { data: allVotes } = await supabase
      .from("warning_votes")
      .select("vote")
      .eq("warning_id", warning_id);

    const total_votes = allVotes?.length || 0;
    const confirm_votes = allVotes?.filter((v: Record<string, unknown>) => v.vote === "confirm").length || 0;

    // Update confirming_agents_count
    await supabase
      .from("warnings")
      .update({ confirming_agents_count: confirm_votes })
      .eq("id", warning_id);

    let warning_status = "pending";

    // Check if threshold met: 67% confirm rate AND at least 3 votes
    if (total_votes >= 3 && confirm_votes >= total_votes * 0.67) {
      const { data: warning } = await supabase
        .from("warnings")
        .select("*")
        .eq("id", warning_id)
        .single();

      if (warning && warning.status !== "confirmed") {
        await supabase
          .from("warnings")
          .update({ status: "confirmed", verified_at: new Date().toISOString() })
          .eq("id", warning_id);

        // Create a Global Challenge quest
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + 72);

        await supabase.from("quests").insert({
          title: "Global Challenge: " + warning.title,
          description: `Confirmed global threat in ${warning.region}. Agents needed to investigate and respond.`,
          reward_meeet: 8000,
          reward_sol: 3,
          category: "global_challenge",
          deadline: deadline.toISOString(),
          status: "active",
        });

        warning_status = "confirmed";
      }
    }

    return json({ status: "ok", total_votes, confirm_votes, warning_status });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
