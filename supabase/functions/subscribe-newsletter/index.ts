// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email, name } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!clean || clean.length > 255 || !EMAIL_RE.test(clean)) {
      return json({ error: "Invalid email" }, 400);
    }
    const cleanName = name ? String(name).trim().slice(0, 100) : null;

    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit: 5 per IP per hour
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _key: `newsletter:${ip}`,
      _max_requests: 5,
      _window_seconds: 3600,
    });
    if (allowed === false) return json({ error: "Too many requests" }, 429);

    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: clean, name: cleanName, status: "active" });

    if (error && !String(error.message).includes("duplicate")) {
      return json({ error: error.message }, 400);
    }
    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
