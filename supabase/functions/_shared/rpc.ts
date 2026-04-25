// Typed, validated wrappers for `supabase.rpc(...)` calls.
//
// Why: raw `sc.rpc("name", { ... })` accepts any object, returns `any`, and
// silently swallows wrong parameter names / wrong types. That makes it easy
// to ship a function that 500s at runtime when the SQL function rejects the
// payload. This module:
//   1. Validates the params with zod BEFORE the network call.
//   2. Throws a typed `RpcValidationError` (status 400) on bad input.
//   3. Returns a strongly-typed result so callers get IDE help.
//
// Use `rpcErrorResponse(e)` to convert thrown errors into a clean JSON 400
// (or pass-through 500 for DB errors) without leaking stack traces.

import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "./http.ts";

// ─── Error type ─────────────────────────────────────────────────────────────

export class RpcValidationError extends Error {
  status = 400 as const;
  code = "rpc_validation_error" as const;
  fn: string;
  fieldErrors: Record<string, string[]>;
  constructor(fn: string, fieldErrors: Record<string, string[]>) {
    super(`Invalid parameters for rpc("${fn}")`);
    this.fn = fn;
    this.fieldErrors = fieldErrors;
  }
}

export class RpcExecutionError extends Error {
  status = 500 as const;
  code = "rpc_execution_error" as const;
  fn: string;
  details: string;
  constructor(fn: string, details: string) {
    super(`rpc("${fn}") failed: ${details}`);
    this.fn = fn;
    this.details = details;
  }
}

/** Build a Response from any error thrown by `callRpc`. */
export function rpcErrorResponse(e: unknown): Response {
  if (e instanceof RpcValidationError) {
    return new Response(
      JSON.stringify({
        error: e.message,
        code: e.code,
        fn: e.fn,
        field_errors: e.fieldErrors,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (e instanceof RpcExecutionError) {
    return new Response(
      JSON.stringify({ error: e.message, code: e.code, fn: e.fn }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const msg = e instanceof Error ? e.message : "Internal error";
  return new Response(
    JSON.stringify({ error: msg, code: "internal_error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ─── Schemas ────────────────────────────────────────────────────────────────
// One schema per RPC actually called from edge functions. Add new ones here
// as you adopt the wrapper. Keep names matching the SQL function exactly.

// SHA-256 hex string (64 hex chars). Matches what `hashKey()` produces.
const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/i, "Must be a 64-char SHA-256 hex string");

export const RpcSchemas = {
  validate_api_key: z.object({
    _key_hash: sha256Hex,
  }),
  check_rate_limit: z.object({
    _key: z.string().min(1).max(255),
    _max_requests: z.number().int().positive().max(100_000),
    _window_seconds: z.number().int().positive().max(86_400),
  }),
  get_twitter_account_credentials: z.object({
    _username: z.string().trim().min(1).max(50),
  }),
  upsert_twitter_account: z.object({
    _username: z.string().trim().min(1).max(50),
    _consumer_key: z.string().min(1),
    _consumer_secret: z.string().min(1),
    _access_token: z.string().min(1),
    _access_token_secret: z.string().min(1),
    _role: z.string().trim().min(1).max(20).optional(),
  }),
  get_raid_campaign_stats: z.object({
    _campaign_tag: z.string().trim().min(1).max(64),
  }),
  log_security_event: z.object({
    _event_type: z.string().trim().min(1).max(100),
    _severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
    _source_ip: z.string().max(45).nullable().optional(),
    _email: z.string().email().max(255).nullable().optional(),
    _user_id: z.string().uuid().nullable().optional(),
    _details: z.record(z.unknown()).optional(),
  }),
  transfer_meeet: z.object({
    from_agent: z.string().uuid(),
    to_agent: z.string().uuid(),
    amount: z.number().int().positive(),
  }),
  cleanup_rls_fixtures: z.object({}).strict(),
  increment_proposal_upvote: z.object({
    _proposal_id: z.string().uuid(),
  }),
} as const;

export type RpcName = keyof typeof RpcSchemas;
export type RpcParams<N extends RpcName> = z.input<(typeof RpcSchemas)[N]>;

// ─── Caller ─────────────────────────────────────────────────────────────────

/**
 * Validate params + execute an `sc.rpc(name, params)` call.
 *
 * Throws:
 *  - {@link RpcValidationError} (400) when params are wrong.
 *  - {@link RpcExecutionError} (500) when Postgres returns an error.
 *
 * The Supabase client is intentionally typed loosely (`any`) here so this
 * helper works with both the anon and service-role clients without forcing
 * generated DB types into every edge function.
 */
export async function callRpc<N extends RpcName, T = unknown>(
  // deno-lint-ignore no-explicit-any
  client: any,
  fn: N,
  params: RpcParams<N>,
): Promise<T> {
  const schema = RpcSchemas[fn];
  const parsed = schema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new RpcValidationError(fn, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  const { data, error } = await client.rpc(fn, parsed.data);
  if (error) {
    throw new RpcExecutionError(fn, error.message ?? String(error));
  }
  return data as T;
}

/**
 * Convenience: run an RPC and return both the typed result AND a ready-made
 * 400 Response when params are invalid. Useful for handlers that want to
 * branch without try/catch.
 *
 * Example:
 *   const r = await tryRpc(sc, "validate_api_key", { _key_hash: hash });
 *   if (!r.ok) return r.response;
 *   const userId = r.data as string | null;
 */
export async function tryRpc<N extends RpcName, T = unknown>(
  // deno-lint-ignore no-explicit-any
  client: any,
  fn: N,
  params: RpcParams<N>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    const data = await callRpc<N, T>(client, fn, params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, response: rpcErrorResponse(e) };
  }
}
