// Shared HTTP utilities for Edge Functions: unified CORS, error handling, JSON helpers, and tiny in-memory cache.
// Import from any function: `import { corsHeaders, json, error, withCors, memoCache } from "../_shared/http.ts";`

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function withCors(extra: Record<string, string> = {}) {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: withCors(extraHeaders),
  });
}

/** Safe error response — never leaks raw stacktraces in production payloads. */
export function error(message: string, status = 400, code?: string) {
  return json({ ok: false, error: message, code: code ?? null }, status);
}

// ============================================================================
// Structured logging
// ============================================================================
// Emits one JSON log line per request with: request_id, function, method,
// path, status, duration_ms, error_code, error_message. Designed to be
// greppable in Supabase edge logs to trace 5xx (e.g. SUPABASE_EDGE_RUNTIME_ERROR).

function inferFunctionName(req: Request): string {
  // Edge function URLs look like .../functions/v1/<name>/<rest>
  try {
    const segs = new URL(req.url).pathname.split("/").filter(Boolean);
    const i = segs.indexOf("v1");
    if (i >= 0 && segs[i + 1]) return segs[i + 1];
    return segs[segs.length - 1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

export interface EdgeLogFields {
  request_id: string;
  function: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  error_code?: string | null;
  error_message?: string | null;
  user_agent?: string | null;
}

export function logEdgeRequest(fields: EdgeLogFields) {
  const payload = { level: fields.status >= 500 ? "error" : fields.status >= 400 ? "warn" : "info",
    ts: new Date().toISOString(), msg: "edge_request", ...fields };
  // Single line JSON so it's parseable in log explorers.
  const line = JSON.stringify(payload);
  if (payload.level === "error") console.error(line);
  else if (payload.level === "warn") console.warn(line);
  else console.log(line);
}

function newRequestId(req: Request): string {
  return req.headers.get("x-request-id")
    || req.headers.get("cf-ray")
    || (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * Wrap any Deno.serve handler to ensure OPTIONS + uniform error envelope
 * + structured per-request logging (request id, duration, status, error code).
 * The request id is also echoed back via the `x-request-id` response header
 * so clients can correlate failures with server logs.
 */
export function handle(
  fn: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const started = performance.now();
    const requestId = newRequestId(req);
    const fnName = inferFunctionName(req);
    const url = (() => { try { return new URL(req.url); } catch { return null; } })();
    const path = url?.pathname ?? "";

    if (req.method === "OPTIONS") {
      const res = new Response("ok", { headers: { ...corsHeaders, "x-request-id": requestId } });
      logEdgeRequest({
        request_id: requestId, function: fnName, method: "OPTIONS", path,
        status: 200, duration_ms: Math.round(performance.now() - started),
        error_code: null, error_message: null,
        user_agent: req.headers.get("user-agent"),
      });
      return res;
    }

    let status = 200;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let response: Response;
    try {
      response = await fn(req);
      status = response.status;
      // Try to surface a JSON `code` field as the error_code when present.
      if (status >= 400) {
        try {
          const cloned = response.clone();
          const ct = cloned.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const body = await cloned.json().catch(() => null) as { code?: string; error?: string } | null;
            if (body && typeof body === "object") {
              errorCode = body.code ?? null;
              errorMessage = typeof body.error === "string" ? body.error : null;
            }
          }
        } catch { /* swallow — logging must never break the response */ }
      }
      // Echo request id for client-side correlation (don't override existing).
      if (!response.headers.has("x-request-id")) {
        const headers = new Headers(response.headers);
        headers.set("x-request-id", requestId);
        response = new Response(response.body, { status, statusText: response.statusText, headers });
      }
    } catch (e) {
      status = 500;
      errorCode = "internal_error";
      errorMessage = e instanceof Error ? e.message : "Internal error";
      console.error(`[edge-error] [${requestId}] [${fnName}]`, errorMessage, e instanceof Error ? e.stack : "");
      response = json(
        { ok: false, error: errorMessage, code: errorCode, request_id: requestId },
        500,
        { "x-request-id": requestId },
      );
    } finally {
      logEdgeRequest({
        request_id: requestId, function: fnName, method: req.method, path,
        status, duration_ms: Math.round(performance.now() - started),
        error_code: errorCode, error_message: errorMessage,
        user_agent: req.headers.get("user-agent"),
      });
    }
    return response;
  };
}

/**
 * Standalone logging wrapper for functions that build their own Response and
 * don't (yet) use `handle()`. Drop-in: `Deno.serve(withLogging(async (req) => {...}))`.
 */
export function withLogging(
  fn: (req: Request, ctx: { requestId: string; functionName: string }) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const started = performance.now();
    const requestId = newRequestId(req);
    const fnName = inferFunctionName(req);
    const path = (() => { try { return new URL(req.url).pathname; } catch { return ""; } })();
    let status = 200;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let response: Response;
    try {
      response = await fn(req, { requestId, functionName: fnName });
      status = response.status;
      if (!response.headers.has("x-request-id")) {
        const headers = new Headers(response.headers);
        headers.set("x-request-id", requestId);
        response = new Response(response.body, { status, statusText: response.statusText, headers });
      }
    } catch (e) {
      status = 500;
      errorCode = "internal_error";
      errorMessage = e instanceof Error ? e.message : "Internal error";
      console.error(`[edge-error] [${requestId}] [${fnName}]`, errorMessage, e instanceof Error ? e.stack : "");
      response = new Response(
        JSON.stringify({ error: errorMessage, code: errorCode, request_id: requestId }),
        { status: 500, headers: { "Content-Type": "application/json", "x-request-id": requestId } },
      );
    } finally {
      logEdgeRequest({
        request_id: requestId, function: fnName, method: req.method, path,
        status, duration_ms: Math.round(performance.now() - started),
        error_code: errorCode, error_message: errorMessage,
        user_agent: req.headers.get("user-agent"),
      });
    }
    return response;
  };
}

/** Tiny in-memory TTL cache. Per-isolate only, but enough to absorb burst traffic. */
const _cache = new Map<string, { value: unknown; expiresAt: number }>();
export const memoCache = {
  get<T = unknown>(key: string): T | undefined {
    const hit = _cache.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      _cache.delete(key);
      return undefined;
    }
    return hit.value as T;
  },
  set(key: string, value: unknown, ttlMs: number) {
    _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  },
  async wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const fresh = await fn();
    this.set(key, fresh, ttlMs);
    return fresh;
  },
};
