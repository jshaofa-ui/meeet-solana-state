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

    const { listing_id } = await req.json();
    if (!listing_id) return json({ error: "listing_id required" }, 400);

    // Get listing
    const { data: listing, error: listErr } = await supabase
      .from("agent_marketplace_listings")
      .select("*")
      .eq("id", listing_id)
      .eq("status", "active")
      .single();

    if (listErr || !listing) return json({ error: "Listing not found or already sold" }, 404);

    if (listing.seller_id === user.id) {
      return json({ error: "Cannot buy your own agent" }, 400);
    }

    // Check buyer balance
    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("balance_meeet")
      .eq("user_id", user.id)
      .single();

    if (!buyerProfile || (buyerProfile.balance_meeet || 0) < listing.price_meeet) {
      return json({ error: "Insufficient MEEET balance" }, 400);
    }

    const price = Number(listing.price_meeet);
    const sellerCut = price * 0.95;
    const treasuryCut = price * 0.05;

    // Deduct from buyer
    await supabase.rpc("increment_agent_balance", {
      agent_uuid: user.id,
      amount: -price,
    }).throwOnError();

    // Pay seller (95%)
    await supabase.rpc("increment_agent_balance", {
      agent_uuid: listing.seller_id,
      amount: sellerCut,
    }).throwOnError();

    // Transfer agent ownership
    await supabase
      .from("agents")
      .update({ user_id: user.id })
      .eq("id", listing.agent_id)
      .throwOnError();

    // Mark listing as sold
    await supabase
      .from("agent_marketplace_listings")
      .update({ status: "sold", buyer_id: user.id, sold_at: new Date().toISOString() })
      .eq("id", listing_id)
      .throwOnError();

    // Record treasury fee
    await supabase
      .from("activity_feed")
      .insert({
        event_type: "marketplace_sale",
        description: `Agent sold for ${price} MEEET. Treasury fee: ${treasuryCut} MEEET.`,
      });

    return json({ success: true, price_paid: price, treasury_fee: treasuryCut });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
