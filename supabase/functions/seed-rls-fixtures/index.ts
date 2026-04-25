// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Missing bearer token" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify caller via anon client + their JWT
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthenticated" }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // President-only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_president")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile?.is_president) return json({ error: "President access required" }, 403);

  // Body: { count?: number } — number of rows to seed per table (default 5, max 50)
  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    /* empty body is fine */
  }
  const requested = Math.max(1, Math.min(50, Number(payload?.count) || 5));

  // Pre-cleanup so re-seeding is idempotent
  const cleanup = await admin.rpc("cleanup_rls_fixtures");
  if (cleanup.error) {
    return json({ error: `cleanup failed: ${cleanup.error.message}` }, 500);
  }

  const stamp = Date.now();

  // newsletter_subscribers fixtures
  const newsletterRows = Array.from({ length: requested }, (_, i) => ({
    email: `fixture-${stamp}-${i}@rls-fixture.test`,
    name: `RLS Fixture ${i + 1}`,
    status: "active",
  }));

  const ns = await admin
    .from("newsletter_subscribers")
    .insert(newsletterRows)
    .select("id");

  // sector_treasury_log fixtures
  const treasuryRows = Array.from({ length: requested }, (_, i) => ({
    sector_key: "ai_architects",
    amount: 1 + i,
    reason: `rls_fixture_seed_${stamp}_${i}`,
  }));

  const stl = await admin
    .from("sector_treasury_log")
    .insert(treasuryRows)
    .select("id");

  return json({
    ok: !ns.error && !stl.error,
    requested_per_table: requested,
    inserted: {
      newsletter_subscribers: ns.data?.length ?? 0,
      sector_treasury_log: stl.data?.length ?? 0,
    },
    errors: {
      newsletter_subscribers: ns.error?.message ?? null,
      sector_treasury_log: stl.error?.message ?? null,
    },
    cleanup_summary: cleanup.data ?? null,
    seeded_at: new Date().toISOString(),
  });
});
