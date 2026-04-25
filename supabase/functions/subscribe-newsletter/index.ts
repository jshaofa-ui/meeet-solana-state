// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Identical success payload for both new + duplicate to prevent enumeration
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { email, name } = body || {};
    const clean = String(email || "").trim().toLowerCase();
    if (!clean || clean.length > 255 || !EMAIL_RE.test(clean)) {
      return json({ error: "Invalid email" }, 400);
    }
    const cleanName = name ? String(name).trim().slice(0, 100) : null;

    const ip =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to identify the calling account (if any) from JWT
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        userId = data?.user?.id ?? null;
      } catch (_) {
        userId = null;
      }
    }

    // Stricter ad-hoc rate limits (window in seconds)
    // 1) Per IP: 3 / 10 minutes, 10 / day
    // 2) Per email: 2 / hour, 5 / day
    // 3) Per account (if logged in): 5 / day
    const checks: Array<{ key: string; max: number; window: number; label: string }> = [
      { key: `newsletter:ip:10m:${ip}`, max: 3, window: 600, label: "ip-10m" },
      { key: `newsletter:ip:1d:${ip}`, max: 10, window: 86400, label: "ip-1d" },
      { key: `newsletter:email:1h:${clean}`, max: 2, window: 3600, label: "email-1h" },
      { key: `newsletter:email:1d:${clean}`, max: 5, window: 86400, label: "email-1d" },
    ];
    if (userId) {
      checks.push({
        key: `newsletter:user:1d:${userId}`,
        max: 5,
        window: 86400,
        label: "user-1d",
      });
    }

    for (const c of checks) {
      const { data: allowed } = await supabase.rpc("check_rate_limit", {
        _key: c.key,
        _max_requests: c.max,
        _window_seconds: c.window,
      });
      if (allowed === false) {
        // Identical 429 shape regardless of which limit tripped
        return json({ error: "Too many requests. Please try again later." }, 429);
      }
    }

    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: clean, name: cleanName, status: "active" });

    // Treat duplicate as success silently — identical response prevents enumeration
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const isDuplicate =
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        (error as any).code === "23505";
      if (!isDuplicate) {
        console.error("[subscribe-newsletter] insert error:", error);
        // Still return generic success to avoid leaking storage state.
        // Real errors are logged server-side.
        return json(SUCCESS_RESPONSE);
      }
    }

    return json(SUCCESS_RESPONSE);
  } catch (e) {
    console.error("[subscribe-newsletter] unhandled:", e);
    // Generic response — don't leak internal errors
    return json(SUCCESS_RESPONSE);
  }
});
