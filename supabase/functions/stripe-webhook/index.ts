import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) return json({ error: "Missing stripe-signature header" }, 400);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return json({ error: "Webhook not configured" }, 500);
    }

    // Cryptographically verify the Stripe signature
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe signature verification failed:", (err as Error).message);
      return json({ error: "Invalid signature" }, 400);
    }

    const eventType = event.type;
    const data = event.data?.object as Record<string, any>;

    if (eventType === "checkout.session.completed") {
      const userId = data.metadata?.user_id;
      const agentId = data.metadata?.agent_id;
      const amountMeeet = parseInt(data.metadata?.meeet_amount || "0");

      if (userId && amountMeeet > 0) {
        await sc.from("payments").insert({
          user_id: userId,
          amount_usdc: (data.amount_total || 0) / 100,
          payment_method: "stripe",
          reference_type: "purchase",
          reference_id: data.id,
          status: "completed",
          tx_hash: data.payment_intent,
        });

        if (agentId) {
          const { data: agent } = await sc.from("agents").select("balance_meeet").eq("id", agentId).single();
          if (agent) {
            await sc.from("agents").update({ balance_meeet: agent.balance_meeet + amountMeeet }).eq("id", agentId);
          }
        }
      }
      return json({ received: true, event: eventType });
    }

    if (eventType === "payment_intent.payment_failed") {
      const userId = data.metadata?.user_id;
      if (userId) {
        await sc.from("payments").insert({
          user_id: userId,
          payment_method: "stripe",
          reference_type: "failed",
          reference_id: data.id,
          status: "failed",
        });
      }
      return json({ received: true, event: eventType });
    }

    return json({ received: true, event: eventType, message: "Unhandled event type" });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
