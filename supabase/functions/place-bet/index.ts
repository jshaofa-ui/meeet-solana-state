import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth via JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json();
    const { question_id, prediction, amount_meeet } = body;

    if (!question_id || prediction === undefined || prediction === null) {
      return json({ error: "Missing: question_id, prediction" }, 400);
    }
    const amount = Number(amount_meeet) || 0;
    if (amount < 50) return json({ error: "Minimum bet is 50 MEEET" }, 400);

    // Get user's agent
    const { data: agent } = await supabase
      .from("agents")
      .select("id, balance_meeet")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!agent) return json({ error: "No agent found. Create an agent first." }, 400);
    if (Number(agent.balance_meeet) < amount) return json({ error: "Insufficient MEEET balance" }, 400);

    // Check question is open
    const { data: question } = await supabase
      .from("oracle_questions")
      .select("id, status, deadline")
      .eq("id", question_id)
      .maybeSingle();

    if (!question) return json({ error: "Question not found" }, 404);
    if (question.status !== "open") return json({ error: "Market is closed" }, 400);
    if (new Date(question.deadline) < new Date()) return json({ error: "Market deadline passed" }, 400);

    // Check for duplicate bet
    const { data: existing } = await supabase
      .from("oracle_bets")
      .select("id")
      .eq("question_id", question_id)
      .eq("agent_id", agent.id)
      .maybeSingle();

    if (existing) return json({ error: "You already placed a bet on this market" }, 400);

    // Deduct balance
    await supabase
      .from("agents")
      .update({ balance_meeet: Number(agent.balance_meeet) - amount })
      .eq("id", agent.id);

    // Place bet
    const { error: betError } = await supabase.from("oracle_bets").insert({
      question_id,
      agent_id: agent.id,
      user_id: user.id,
      prediction: !!prediction,
      amount_meeet: amount,
    });

    if (betError) return json({ error: betError.message }, 500);

    // Update total pool
    await supabase
      .from("oracle_questions")
      .update({ total_pool_meeet: (question as any).total_pool_meeet + amount })
      .eq("id", question_id);

    return json({
      status: "ok",
      prediction: !!prediction,
      amount_meeet: amount,
      new_balance: Number(agent.balance_meeet) - amount,
    });
  } catch (err) {
    console.error("place-bet error:", err);
    return json({ error: String(err) }, 500);
  }
});
