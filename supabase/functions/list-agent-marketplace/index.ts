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

    if (req.method === "GET") {
      // List active marketplace listings
      const { data, error } = await supabase
        .from("agent_marketplace_listings")
        .select("*, agents(name, class, level, xp)")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 400);
      return json({ listings: data });
    }

    if (req.method === "POST") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authError || !user) return json({ error: "Unauthorized" }, 401);

      const { agent_id, price_meeet, description } = await req.json();
      if (!agent_id || !price_meeet) return json({ error: "agent_id and price_meeet required" }, 400);

      // Verify agent belongs to user
      const { data: agent } = await supabase
        .from("agents")
        .select("id, user_id")
        .eq("id", agent_id)
        .single();

      if (!agent || agent.user_id !== user.id) {
        return json({ error: "Agent not found or not owned by you" }, 403);
      }

      const { data: listing, error: insertError } = await supabase
        .from("agent_marketplace_listings")
        .insert({
          agent_id,
          seller_id: user.id,
          price_meeet,
          description: description || null,
          status: "active",
        })
        .select()
        .single();

      if (insertError) return json({ error: insertError.message }, 400);
      return json({ listing_id: listing.id });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
