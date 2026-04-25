// Automated smoke tests for critical edge functions.
// - Pings each endpoint with a minimal payload
// - Validates JSON response shape
// - Records every run in smoke_test_runs
// - Logs a high-severity security_event on any failure (alert hook)
//
// Trigger: pg_cron (every 10 min) or manual GET/POST.
// Auth: presidents only for manual runs; cron uses service_role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handle, json, error } from "../_shared/http.ts";

interface SmokeTarget {
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  // Optional shape validator beyond JSON parseability
  validate?: (data: unknown) => string | null;
}

const TARGETS: SmokeTarget[] = [
  {
    name: "get-meeet-price",
    path: "get-meeet-price",
    method: "GET",
    validate: (d) => {
      const obj = d as Record<string, unknown> | null;
      if (!obj || typeof obj !== "object") return "not an object";
      if (typeof obj.priceUsd !== "number") return "missing priceUsd:number";
      if (typeof obj.fetchedAt !== "number") return "missing fetchedAt:number";
      return null;
    },
  },
  {
    name: "agent-chat-ai",
    path: "agent-chat-ai",
    method: "POST",
    body: { messages: [{ role: "user", content: "ping" }], smoke: true },
    validate: (d) => {
      // Accept either a streaming bootstrap, an error envelope, or any JSON object —
      // we only require valid JSON for chat (full chat response is heavy).
      return d && typeof d === "object" ? null : "not a JSON object";
    },
  },
  {
    name: "agent-api",
    path: "agent-api",
    method: "GET",
    validate: (d) => (d && typeof d === "object" ? null : "not a JSON object"),
  },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

async function pingTarget(t: SmokeTarget) {
  const start = Date.now();
  const url = `${FUNCTIONS_BASE}/${t.path}`;
  let status = 0;
  let okFlag = false;
  let validJson = false;
  let errMsg: string | null = null;
  let reqId: string | null = null;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: t.method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ANON_KEY || SERVICE_ROLE}`,
        apikey: ANON_KEY || SERVICE_ROLE,
        "x-smoke-test": "1",
      },
      body: t.method === "POST" ? JSON.stringify(t.body ?? {}) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    status = res.status;
    reqId = res.headers.get("x-request-id");
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      validJson = true;
      const shapeError = t.validate?.(data) ?? null;
      if (shapeError) {
        errMsg = `shape: ${shapeError}`;
      } else if (status >= 200 && status < 300) {
        okFlag = true;
      } else {
        errMsg = `http ${status}`;
      }
    } catch {
      validJson = false;
      errMsg = `non-JSON response (${text.slice(0, 120)})`;
    }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : "fetch failed";
  }

  return {
    endpoint: t.name,
    status_code: status || null,
    ok: okFlag,
    valid_json: validJson,
    duration_ms: Date.now() - start,
    error_message: errMsg,
    request_id: reqId,
  };
}

Deno.serve(handle(async (req) => {
  // deno-lint-ignore no-explicit-any
  const sb: any = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Allow: service_role bearer, INTERNAL_SERVICE_SECRET header, cron marker, or president JWT.
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const cronSource = req.headers.get("x-cron-source") ?? "";
  const expectedCronSecret = Deno.env.get("INTERNAL_SERVICE_SECRET") ?? "";
  const isServiceRole = !!SERVICE_ROLE && authHeader.includes(SERVICE_ROLE);
  const isCronSecret = !!expectedCronSecret && cronSecret === expectedCronSecret;
  const isCronMarker = cronSource === "smoke-test-cron";

  if (!isServiceRole && !isCronSecret && !isCronMarker) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return error("Missing auth", 403, "forbidden");
    const { data: userData, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !userData?.user) return error("Invalid token", 403, "forbidden");
    const { data: prof } = await sb
      .from("profiles")
      .select("is_president")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!prof?.is_president) return error("President only", 403, "forbidden");
  }

  const results = await Promise.all(TARGETS.map(pingTarget));

  // Persist every run
  await sb.from("smoke_test_runs").insert(results);

  // Alert on any failure via security_events (severity=high → alert_sent flag set)
  const failures = results.filter((r) => !r.ok);
  for (const f of failures) {
    await sb.rpc("log_security_event", {
      _event_type: "smoke_test_failure",
      _severity: "high",
      _details: {
        endpoint: f.endpoint,
        status_code: f.status_code,
        valid_json: f.valid_json,
        error: f.error_message,
        request_id: f.request_id,
        duration_ms: f.duration_ms,
      },
    });
  }

  return json({
    ran_at: new Date().toISOString(),
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    results,
  });
}));
