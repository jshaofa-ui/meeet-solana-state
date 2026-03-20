import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { strategy_id } = await req.json();
    if (!strategy_id) return json({ error: "strategy_id required" }, 400);

    // Get strategy
    const { data: strategy, error: stratErr } = await supabase
      .from("agent_strategies")
      .select("*")
      .eq("id", strategy_id)
      .single();

    if (stratErr || !strategy) return json({ error: "Strategy not found" }, 404);

    const price = Number(strategy.price_meeet || 0);

    if (price > 0) {
      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance_meeet")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile.balance_meeet || 0) < price) {
        return json({ error: "Insufficient MEEET balance" }, 400);
      }

      // Deduct
      await supabase.rpc("increment_agent_balance", {
        agent_uuid: user.id,
        amount: -price,
      }).throwOnError();
    }

    // Record purchase
    await supabase
      .from("activity_feed")
      .insert({
        event_type: "strategy_purchase",
        agent_id: null,
        description: `User purchased strategy "${strategy.name}" for ${price} MEEET`,
      });

    return json({
      success: true,
      strategy_name: strategy.name,
      prompt_template: strategy.prompt_template || strategy.description,
      price_paid: price,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
