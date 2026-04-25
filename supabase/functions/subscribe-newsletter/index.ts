// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Identical response for any outcome (anti-enumeration)
const SUCCESS_RESPONSE = {
  success: true,
  message: "If the email is valid, you're subscribed.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function logEvent(
  supabase: any,
  eventType: string,
  severity: string,
  ip: string | null,
  email: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    await supabase.rpc("log_security_event", {
      _event_type: eventType,
      _severity: severity,
      _source_ip: ip,
      _email: email,
      _user_id: null,
      _details: details,
    });
  } catch (e) {
    console.error("[subscribe-newsletter] logEvent failed", String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = getIp(req);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    await logEvent(supabase, "newsletter_invalid_payload", "low", ip, null, {});
    return json(SUCCESS_RESPONSE);
  }

  const clean = String(payload?.email || "").trim().toLowerCase();
  const cleanName = payload?.name ? String(payload.name).trim().slice(0, 100) : null;

  if (!clean || clean.length > 255 || !EMAIL_RE.test(clean)) {
    await logEvent(supabase, "newsletter_invalid_email", "low", ip, clean || null, {});
    return json(SUCCESS_RESPONSE);
  }

  // Layered rate limits
  const checks = [
    { key: `newsletter:ip:10m:${ip}`, max: 3, window: 600, scope: "ip_10m" },
    { key: `newsletter:ip:1d:${ip}`, max: 10, window: 86400, scope: "ip_1d" },
    { key: `newsletter:email:1h:${clean}`, max: 2, window: 3600, scope: "email_1h" },
    { key: `newsletter:email:1d:${clean}`, max: 5, window: 86400, scope: "email_1d" },
  ];

  for (const c of checks) {
    const { data: ok } = await supabase.rpc("check_rate_limit", {
      _key: c.key,
      _max_requests: c.max,
      _window_seconds: c.window,
    });
    if (ok === false) {
      await logEvent(supabase, "newsletter_rate_limited", "medium", ip, clean, {
        scope: c.scope,
      });
      return json(SUCCESS_RESPONSE);
    }
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: clean, name: cleanName, status: "active" });

  if (error) {
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes("duplicate")) {
      await logEvent(supabase, "newsletter_duplicate_attempt", "low", ip, clean, {});
    } else {
      await logEvent(supabase, "newsletter_insert_error", "medium", ip, clean, {
        error: msg,
      });
    }
  } else {
    await logEvent(supabase, "newsletter_subscribed", "info", ip, clean, {});
  }

  return json(SUCCESS_RESPONSE);
});
