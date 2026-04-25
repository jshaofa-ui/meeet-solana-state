// RLS regression tests: verify that anon (public) clients cannot
// INSERT or UPDATE into protected tables. We hit PostgREST directly
// with the anon publishable key — no service role, no auth header.
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Load .env without enforcing .env.example completeness (other unrelated vars may be missing locally).
try {
  await load({ export: true, allowEmptyValues: true, examplePath: null });
} catch (_) { /* env may already be populated by the runner */ }

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

assert(SUPABASE_URL, "VITE_SUPABASE_URL missing");
assert(ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY missing");

const RANDOM_UUID = "00000000-0000-0000-0000-000000000001";

// Tables that must reject anonymous writes (INSERT + UPDATE).
// Each entry includes a minimal payload PostgREST will accept syntactically;
// RLS must reject it before any constraint check matters.
const PROTECTED_TABLES: {
  table: string;
  insertPayload: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
}[] = [
  {
    table: "trial_agents",
    insertPayload: { session_id: "rls-probe", name: "probe" },
    updatePayload: { name: "rls-probe-updated" },
  },
  {
    table: "agent_billing",
    insertPayload: { user_id: RANDOM_UUID, balance_usd: 999 },
    updatePayload: { balance_usd: 0 },
  },
  {
    table: "agents",
    insertPayload: { user_id: RANDOM_UUID, name: "probe-agent" },
    updatePayload: { name: "rls-probe-updated" },
  },
  {
    table: "agent_actions",
    insertPayload: { user_id: RANDOM_UUID, action_type: "probe" },
    updatePayload: { action_type: "rls-probe-updated" },
  },
  {
    table: "agent_earnings",
    insertPayload: { user_id: RANDOM_UUID, agent_id: RANDOM_UUID, source: "probe" },
    updatePayload: { source: "rls-probe-updated" },
  },
  {
    table: "agent_stakes",
    insertPayload: { user_id: RANDOM_UUID, agent_id: RANDOM_UUID, amount_meeet: 1 },
    updatePayload: { amount_meeet: 0 },
  },
  {
    table: "deployed_agents",
    insertPayload: { user_id: RANDOM_UUID, agent_id: RANDOM_UUID },
    updatePayload: { status: "rls-probe" },
  },
  {
    table: "api_keys",
    insertPayload: { user_id: RANDOM_UUID, key_hash: "x", key_prefix: "x" },
    updatePayload: { name: "rls-probe-updated" },
  },
];

function restUrl(table: string, qs = ""): string {
  return `${SUPABASE_URL}/rest/v1/${table}${qs}`;
}

const baseHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

// Acceptable "blocked" outcomes:
//  401/403 — RLS denied (preferred signal)
//  404     — row not found (UPDATE matched nothing under RLS)
//  409     — conflict / FK violation before write
//  400 + PGRST2xx — PostgREST schema-cache error (also blocks the write)
function isBlocked(status: number, body: string): boolean {
  if (status === 401 || status === 403 || status === 404 || status === 409) return true;
  if (status === 400 && /"code":"PGRST\d+"/.test(body)) return true;
  return false;
}

for (const { table, insertPayload, updatePayload } of PROTECTED_TABLES) {
  Deno.test(`anon INSERT into ${table} is blocked`, async () => {
    const res = await fetch(restUrl(table), {
      method: "POST",
      headers: { ...baseHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(insertPayload),
    });
    const body = await res.text();
    assert(
      isBlocked(res.status, body),
      `Expected anon INSERT into ${table} to be blocked, got ${res.status}: ${body.slice(0, 200)}`,
    );
    // Sanity: response must not contain the inserted row id.
    assert(
      !/"id":\s*"[0-9a-f-]{36}"/.test(body),
      `Anon INSERT into ${table} appears to have returned a row: ${body.slice(0, 200)}`,
    );
  });

  Deno.test(`anon UPDATE on ${table} is blocked`, async () => {
    const res = await fetch(restUrl(table, `?id=eq.${RANDOM_UUID}`), {
      method: "PATCH",
      headers: { ...baseHeaders, Prefer: "return=representation" },
      body: JSON.stringify(updatePayload),
    });
    const body = await res.text();
    // Blocked: 401/403/404/409, OR 200/204 with empty body `[]` (RLS filtered).
    const emptyOk = (res.status === 200 || res.status === 204) && (body.trim() === "[]" || body.trim() === "");
    assert(
      isBlocked(res.status, body) || emptyOk,
      `Expected anon UPDATE on ${table} to be blocked, got ${res.status}: ${body.slice(0, 200)}`,
    );
  });
}

// Bonus: verify RLS is enabled by trying an unauthenticated SELECT on agent_billing
// (financial data — must never be readable by anon).
Deno.test("anon SELECT from agent_billing returns no rows", async () => {
  const res = await fetch(restUrl("agent_billing", "?select=user_id,balance_usd&limit=1"), {
    headers: baseHeaders,
  });
  const body = await res.text();
  if (res.status === 200) {
    assertEquals(body.trim(), "[]", `agent_billing leaked data to anon: ${body.slice(0, 200)}`);
  } else {
    assert(
      isBlocked(res.status, body),
      `Expected blocked or empty, got ${res.status}: ${body.slice(0, 200)}`,
    );
  }
});
