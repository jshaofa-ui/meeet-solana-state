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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: questions, error } = await supabase
      .from("oracle_questions")
      .select("*")
      .eq("status", "open")
      .order("total_pool_meeet", { ascending: false })
      .limit(20);

    if (error) return json({ error: error.message }, 500);

    const enriched = await Promise.all(
      (questions || []).map(async (q: Record<string, unknown>) => {
        const { data: bets } = await supabase
          .from("oracle_bets")
          .select("prediction, amount_meeet")
          .eq("question_id", q.id);

        const yes_count = bets?.filter((b: Record<string, unknown>) => b.prediction === true).length || 0;
        const no_count = bets?.filter((b: Record<string, unknown>) => b.prediction === false).length || 0;
        const total = yes_count + no_count;

        const yes_percentage = total > 0 ? Math.round((yes_count / total) * 100) : 50;
        const no_percentage = 100 - yes_percentage;

        const deadline = new Date(q.deadline as string);
        const now = new Date();
        const time_remaining_hours = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

        return {
          ...q,
          yes_count,
          no_count,
          yes_percentage,
          no_percentage,
          time_remaining_hours,
        };
      })
    );

    return json({ questions: enriched, total: enriched.length });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
