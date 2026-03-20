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

    // Internal only — called by pay-sol/process-transaction after payment
    const { amount_sol, tx_signature, user_id, source } = await req.json();
    if (!amount_sol) return json({ error: "amount_sol required" }, 400);

    // Record the LP contribution intent
    const { data, error } = await supabase
      .from("payments")
      .insert({
        user_id: user_id || null,
        amount_sol: Number(amount_sol),
        lp_contribution_sol: Number(amount_sol),
        tx_signature: tx_signature || null,
        payment_type: "lp_contribution",
        status: "recorded",
        source: source || "auto",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // If payments table doesn't have all columns, try minimal insert
      const { data: fallback, error: fallbackErr } = await supabase
        .from("activity_feed")
        .insert({
          event_type: "lp_contribution",
          description: `LP contribution: ${amount_sol} SOL (tx: ${tx_signature || "pending"})`,
        })
        .select()
        .single();

      if (fallbackErr) return json({ error: fallbackErr.message }, 400);
      return json({ recorded: true, id: fallback.id, method: "activity_feed" });
    }

    return json({ recorded: true, id: data.id, amount_sol: Number(amount_sol) });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
