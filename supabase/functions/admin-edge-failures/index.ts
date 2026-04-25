// @ts-nocheck
// Aggregates Supabase Edge Function HTTP logs and returns failing functions
// (4xx/5xx counts) plus the most recent error message per function.
//
// President-only. Uses the Supabase Management Analytics API with
// SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.
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
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Missing bearer token" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mgmtToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  const projectRef = Deno.env.get("SUPABASE_PROJECT_REF");

  // Identify caller via anon client + their JWT
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthenticated" }, 401);

  // President-only
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("is_president")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!profile?.is_president) return json({ error: "President access required" }, 403);

  if (!mgmtToken || !projectRef) {
    return json({
      error: "missing_management_credentials",
      message:
        "SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be set in edge function secrets to query analytics.",
    }, 500);
  }

  // Window: default last 24h, max 7d
  let payload: any = {};
  try { payload = req.method === "POST" ? await req.json() : {}; } catch { /* noop */ }
  const hours = Math.max(1, Math.min(24 * 7, Number(payload?.hours) || 24));
  const sinceMs = Date.now() - hours * 3600 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Aggregate counts of 4xx/5xx responses per function
  const aggSql = `
    select
      coalesce(m.function_id, 'unknown') as function_id,
      countif(response.status_code between 400 and 499) as count_4xx,
      countif(response.status_code between 500 and 599) as count_5xx,
      max(function_edge_logs.timestamp) as last_failure_at
    from function_edge_logs
    cross join unnest(metadata) as m
    cross join unnest(m.response) as response
    where function_edge_logs.timestamp >= timestamp '${sinceIso}'
      and response.status_code >= 400
    group by function_id
    order by (count_5xx * 10 + count_4xx) desc
    limit 200
  `;

  // Most recent failing event message per function (used as "last error")
  const recentSql = `
    select
      coalesce(m.function_id, 'unknown') as function_id,
      function_edge_logs.timestamp as ts,
      response.status_code as status,
      request.method as method,
      event_message as message
    from function_edge_logs
    cross join unnest(metadata) as m
    cross join unnest(m.response) as response
    cross join unnest(m.request) as request
    where function_edge_logs.timestamp >= timestamp '${sinceIso}'
      and response.status_code >= 400
    order by function_edge_logs.timestamp desc
    limit 500
  `;

  async function runQuery(sql: string) {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql }),
      },
    );
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`analytics ${r.status}: ${text.slice(0, 300)}`);
    }
    const j = await r.json();
    return j?.result ?? [];
  }

  let aggRows: any[] = [];
  let recentRows: any[] = [];
  try {
    [aggRows, recentRows] = await Promise.all([runQuery(aggSql), runQuery(recentSql)]);
  } catch (e) {
    return json({ error: "analytics_query_failed", message: (e as Error).message }, 502);
  }

  // Index latest error message per function_id
  const latestById = new Map<string, { ts: number; status: number; method: string; message: string }>();
  for (const row of recentRows) {
    const id = String(row.function_id ?? "unknown");
    if (latestById.has(id)) continue;
    latestById.set(id, {
      ts: typeof row.ts === "number" ? row.ts : new Date(row.ts).getTime(),
      status: Number(row.status) || 0,
      method: String(row.method ?? ""),
      message: String(row.message ?? "").slice(0, 800),
    });
  }

  // Resolve function names from list endpoint
  const nameById = new Map<string, string>();
  try {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/functions`,
      { headers: { Authorization: `Bearer ${mgmtToken}` } },
    );
    if (r.ok) {
      const list = (await r.json()) as Array<{ id: string; slug?: string; name?: string }>;
      for (const f of list || []) nameById.set(f.id, f.slug || f.name || f.id);
    }
  } catch { /* names are optional */ }

  const functions = aggRows.map((r) => {
    const id = String(r.function_id ?? "unknown");
    const latest = latestById.get(id);
    return {
      function_id: id,
      function_name: nameById.get(id) ?? id,
      count_4xx: Number(r.count_4xx) || 0,
      count_5xx: Number(r.count_5xx) || 0,
      total_failures: (Number(r.count_4xx) || 0) + (Number(r.count_5xx) || 0),
      last_failure_at: r.last_failure_at
        ? new Date(typeof r.last_failure_at === "number" ? r.last_failure_at / 1000 : r.last_failure_at).toISOString()
        : null,
      last_error: latest
        ? {
          status: latest.status,
          method: latest.method,
          message: latest.message,
          at: new Date(latest.ts / 1000).toISOString(),
        }
        : null,
    };
  });

  return json({
    ok: true,
    window_hours: hours,
    since: sinceIso,
    generated_at: new Date().toISOString(),
    total_failing_functions: functions.length,
    functions,
  });
});
