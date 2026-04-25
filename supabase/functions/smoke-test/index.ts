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

import { z, ZodSchema } from "https://esm.sh/zod@3.23.8";

interface SmokeTarget {
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  // Per-endpoint JSON schema (Zod). Response must conform on top of being valid JSON.
  schema: ZodSchema;
  // Optional: also accept a structured error envelope as a "valid shape" (still ok=false if HTTP !2xx).
  errorSchema?: ZodSchema;
}

// Common error envelope used across our edge functions
const ErrorEnvelope = z.object({
  error: z.union([z.string(), z.record(z.unknown())]),
}).passthrough();

const TARGETS: SmokeTarget[] = [
  {
    name: "get-meeet-price",
    path: "get-meeet-price",
    method: "GET",
    schema: z.object({
      priceUsd: z.number().finite().nonnegative(),
      fetchedAt: z.number().int().positive(),
    }).passthrough(),
    errorSchema: ErrorEnvelope,
  },
  {
    name: "agent-chat-ai",
    path: "agent-chat-ai",
    method: "POST",
    body: { messages: [{ role: "user", content: "ping" }], smoke: true },
    // Either a chat payload (message/content/choices) or our error envelope.
    schema: z.union([
      z.object({ message: z.string() }).passthrough(),
      z.object({ content: z.string() }).passthrough(),
      z.object({ choices: z.array(z.unknown()).min(1) }).passthrough(),
      z.object({ reply: z.string() }).passthrough(),
    ]),
    errorSchema: ErrorEnvelope,
  },
  {
    name: "agent-api",
    path: "agent-api",
    method: "GET",
    // Discovery/root response: object with at least one known field.
    schema: z.object({}).passthrough().refine(
      (o) => Object.keys(o).length > 0,
      { message: "empty object" },
    ),
    errorSchema: ErrorEnvelope,
  },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

async function pingTarget(t: SmokeTarget) {
const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
const BACKOFF_MS = [0, 500, 1500]; // delay before each attempt index

interface AttemptResult {
  status: number;
  okFlag: boolean;
  validJson: boolean;
  errMsg: string | null;
  reqId: string | null;
  retryable: boolean;
}

async function singleAttempt(t: SmokeTarget): Promise<AttemptResult> {
  const url = `${FUNCTIONS_BASE}/${t.path}`;
  let status = 0;
  let okFlag = false;
  let validJson = false;
  let errMsg: string | null = null;
  let reqId: string | null = null;
  let retryable = false;

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
      const primary = t.schema.safeParse(data);
      const fallback = !primary.success && t.errorSchema
        ? t.errorSchema.safeParse(data)
        : null;
      const shapeOk = primary.success || (fallback?.success ?? false);

      if (!shapeOk) {
        const issues = primary.success ? [] : primary.error.issues.slice(0, 3).map(
          (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
        );
        errMsg = `shape: ${issues.join("; ") || "schema mismatch"}`;
        retryable = false; // Shape errors are deterministic — don't retry.
      } else if (status >= 200 && status < 300) {
        okFlag = !fallback?.success;
        if (!okFlag) errMsg = `error envelope on 2xx`;
      } else {
        errMsg = `http ${status}`;
        retryable = status >= 500 || status === 429; // retry on server / rate-limit
      }
    } catch {
      validJson = false;
      errMsg = `non-JSON response (${text.slice(0, 120)})`;
      retryable = true; // Likely transient (gateway HTML, partial body, etc.)
    }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : "fetch failed";
    retryable = true; // Network/timeout — retry.
  }

  return { status, okFlag, validJson, errMsg, reqId, retryable };
}

async function pingTarget(t: SmokeTarget) {
  const start = Date.now();
  let last: AttemptResult | null = null;
  let attempts = 0;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (BACKOFF_MS[i] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    }
    attempts = i + 1;
    last = await singleAttempt(t);
    if (last.okFlag || !last.retryable) break;
  }

  const r = last!;
  return {
    endpoint: t.name,
    status_code: r.status || null,
    ok: r.okFlag,
    valid_json: r.validJson,
    duration_ms: Date.now() - start,
    error_message: r.errMsg
      ? attempts > 1
        ? `${r.errMsg} (after ${attempts} attempts)`
        : r.errMsg
      : null,
    request_id: r.reqId,
    attempts,
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
