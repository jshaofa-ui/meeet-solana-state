// Newsletter unsubscribe: validates token format, rate-limits per IP, and logs
// every outcome (invalid format, rate-limited, unknown token, success) to the
// security_events table for alerting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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

  const ip = getClientIp(req);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const logEvent = async (
    type: string,
    severity: string,
    details: Record<string, unknown> = {},
  ) => {
    try {
      await supabase.rpc("log_security_event", {
        _event_type: type,
        _severity: severity,
        _source_ip: ip,
        _email: null,
        _user_id: null,
        _details: details,
      });
    } catch (e) {
      console.error("[unsubscribe-newsletter] logEvent failed", String(e));
    }
  };

  const token = (rawToken ?? "").trim().toLowerCase();
  if (!TOKEN_RE.test(token)) {
    await logEvent("unsubscribe_invalid_token", "medium", { length: token.length });
    return json(GENERIC_OK);
  }

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    _key: `unsubscribe:ip:${ip}`,
    _max_requests: 10,
    _window_seconds: 600,
  });
  if (allowed === false) {
    await logEvent("unsubscribe_rate_limited", "high", {});
    return json(GENERIC_OK);
  }

  const { data: updated, error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed" })
    .eq("unsubscribe_token", token)
    .eq("status", "active")
    .select("id");

  if (error) {
    console.error("[unsubscribe-newsletter] update failed", error.message);
    await logEvent("unsubscribe_db_error", "medium", { error: error.message });
  } else if (!updated || updated.length === 0) {
    await logEvent("unsubscribe_unknown_token", "medium", {});
  } else {
    await logEvent("unsubscribe_success", "info", { count: updated.length });
  }

  return json(GENERIC_OK);
});
