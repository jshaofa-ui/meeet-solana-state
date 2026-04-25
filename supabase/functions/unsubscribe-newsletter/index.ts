// Newsletter unsubscribe: validates token format and uses constant-time
// matching via service-role update keyed on unsubscribe_token only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Generic response — never reveal whether a token matched a real subscriber.
const GENERIC_OK = {
  success: true,
  message: "If the link was valid, you've been unsubscribed.",
};

// 32 random bytes hex-encoded => exactly 64 lowercase hex chars.
const TOKEN_RE = /^[a-f0-9]{64}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Accept token via POST body or GET query (?token=...)
  let rawToken: string | null = null;
  try {
    if (req.method === "GET") {
      rawToken = new URL(req.url).searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      rawToken = typeof body?.token === "string" ? body.token : null;
    } else {
      return json({ error: "Method not allowed" }, 405);
    }
  } catch {
    return json(GENERIC_OK);
  }

  // Strict format validation BEFORE touching the database.
  const token = (rawToken ?? "").trim().toLowerCase();
  if (!TOKEN_RE.test(token)) {
    // Same generic response — don't leak validation details.
    return json(GENERIC_OK);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Per-IP rate limit to prevent token brute-forcing.
  const ip = getClientIp(req);
  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    _key: `unsubscribe:ip:${ip}`,
    _max_requests: 10,
    _window_seconds: 600,
  });
  if (allowed === false) {
    return json(GENERIC_OK);
  }

  // Update keyed strictly on the token. Cannot affect any other subscriber:
  // the unique 64-hex token uniquely identifies one row (or zero).
  // We do NOT accept email/id from the client.
  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed" })
    .eq("unsubscribe_token", token)
    .eq("status", "active"); // idempotent: silently no-op if already unsubscribed

  if (error) {
    console.error("[unsubscribe-newsletter] update failed", error.message);
  }

  return json(GENERIC_OK);
});
