#!/usr/bin/env node
/**
 * RLS Integration Tests
 *
 * Spins up seeded fixture state via the `seed-rls-fixtures` edge function,
 * then exercises real reads/writes from three identities:
 *   - anon (no JWT)
 *   - authenticated non-president
 *   - authenticated president
 *
 * Verifies expected RLS outcomes for `newsletter_subscribers` and
 * `sector_treasury_log`. Writes a markdown report to ./rls-report.md and
 * exits non-zero on any failed assertion.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRES_EMAIL = process.env.RLS_TEST_PRESIDENT_EMAIL;
const PRES_PASS = process.env.RLS_TEST_PRESIDENT_PASSWORD;
const USER_EMAIL = process.env.RLS_TEST_USER_EMAIL;
const USER_PASS = process.env.RLS_TEST_USER_PASSWORD;

if (!URL || !ANON || !SERVICE || !PRES_EMAIL || !PRES_PASS || !USER_EMAIL || !USER_PASS) {
  console.error("Missing required env vars");
  process.exit(2);
}

/** @type {Array<{name:string, expected:string, actual:string, passed:boolean, detail?:string}>} */
const results = [];

function classifyWrite(error) {
  if (!error) return "allowed";
  const msg = (error.message || "").toLowerCase();
  if (
    msg.includes("permission denied") ||
    msg.includes("violates row-level") ||
    msg.includes("row-level security") ||
    msg.includes("rls")
  ) return "blocked";
  return `error: ${error.message}`;
}

function classifyRead(error, data) {
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("permission denied") || msg.includes("rls")) return "blocked";
    return `error: ${error.message}`;
  }
  return Array.isArray(data) && data.length === 0 ? "blocked (empty)" : "allowed";
}

function assert(name, expected, actual, detail) {
  const passed = actual === expected;
  results.push({ name, expected, actual, passed, detail });
  console.log(`${passed ? "✅" : "❌"} ${name} — expected=${expected} actual=${actual}${detail ? ` (${detail})` : ""}`);
}

async function signIn(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error(`signIn(${email}) returned no token`);
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function callEdge(path, jwt, body) {
  const r = await fetch(`${URL}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, body: json };
}

async function ensurePresident(serviceClient, email) {
  const { data: list, error } = await serviceClient.auth.admin.listUsers();
  if (error) throw new Error(`listUsers: ${error.message}`);
  const u = list.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`President test user ${email} not found in auth`);
  const { error: upErr } = await serviceClient
    .from("profiles")
    .update({ is_president: true })
    .eq("user_id", u.id);
  if (upErr) throw new Error(`could not flag president: ${upErr.message}`);
  return u.id;
}

async function main() {
  const service = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Ensure the test president actually has the flag set (idempotent)
  const presUid = await ensurePresident(service, PRES_EMAIL);
  console.log(`President test uid: ${presUid}`);

  // 2) Sign in both identities
  const presClient = await signIn(PRES_EMAIL, PRES_PASS);
  const userClient = await signIn(USER_EMAIL, USER_PASS);
  const anonClient = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

  // 3) Seed fixtures via edge function (president only)
  const presJwt = (await presClient.auth.getSession()).data.session?.access_token;
  const seed = await callEdge("seed-rls-fixtures", presJwt, { count: 5 });
  if (seed.status !== 200 || !seed.body.ok) {
    throw new Error(`seed-rls-fixtures failed: ${JSON.stringify(seed)}`);
  }
  console.log("Seeded:", seed.body.inserted);

  // 4) Probe: newsletter_subscribers — all client roles must be blocked from reading
  {
    const r = await anonClient.from("newsletter_subscribers").select("id").limit(1);
    assert("newsletter_subscribers · anon SELECT", "blocked", classifyRead(r.error, r.data));
  }
  {
    const r = await userClient.from("newsletter_subscribers").select("id").limit(1);
    assert("newsletter_subscribers · authed SELECT", "blocked", classifyRead(r.error, r.data));
  }
  {
    const r = await presClient.from("newsletter_subscribers").select("id").limit(1);
    assert("newsletter_subscribers · president SELECT", "blocked", classifyRead(r.error, r.data));
  }

  // INSERT (public subscribe path is via edge function; direct client INSERT must be blocked)
  {
    const r = await anonClient.from("newsletter_subscribers").insert({
      email: `probe-anon-${Date.now()}@rls-fixture.test`,
      status: "active",
    });
    assert("newsletter_subscribers · anon INSERT", "blocked", classifyWrite(r.error));
  }
  {
    const r = await userClient.from("newsletter_subscribers").insert({
      email: `probe-user-${Date.now()}@rls-fixture.test`,
      status: "active",
    });
    assert("newsletter_subscribers · authed INSERT", "blocked", classifyWrite(r.error));
  }

  // UPDATE / DELETE
  {
    const r = await userClient.from("newsletter_subscribers")
      .update({ status: "unsubscribed" })
      .like("email", "%@rls-fixture.test");
    assert("newsletter_subscribers · authed UPDATE", "blocked", classifyWrite(r.error));
  }
  {
    const r = await userClient.from("newsletter_subscribers")
      .delete()
      .like("email", "%@rls-fixture.test");
    assert("newsletter_subscribers · authed DELETE", "blocked", classifyWrite(r.error));
  }

  // 5) Probe: sector_treasury_log — anon blocked, authenticated allowed (read-only)
  {
    const r = await anonClient.from("sector_treasury_log").select("id").limit(1);
    assert("sector_treasury_log · anon SELECT", "blocked", classifyRead(r.error, r.data));
  }
  {
    const r = await userClient.from("sector_treasury_log").select("id").limit(1);
    assert("sector_treasury_log · authed SELECT", "allowed", classifyRead(r.error, r.data));
  }
  {
    const r = await anonClient.from("sector_treasury_log").insert({
      sector_key: "ai_architects",
      amount: 1,
      reason: "rls_fixture_probe_anon",
    });
    assert("sector_treasury_log · anon INSERT", "blocked", classifyWrite(r.error));
  }
  {
    const r = await userClient.from("sector_treasury_log").insert({
      sector_key: "ai_architects",
      amount: 1,
      reason: "rls_fixture_probe_authed",
    });
    assert("sector_treasury_log · authed INSERT", "blocked", classifyWrite(r.error));
  }

  // 6) Profiles · no self-promotion to president
  {
    const userUid = (await userClient.auth.getUser()).data.user?.id;
    const r = await userClient.from("profiles")
      .update({ is_president: true })
      .eq("user_id", userUid);
    assert("profiles · self-promote is_president", "blocked", classifyWrite(r.error));

    // Confirm via service that the flag is still false
    const { data: p } = await service.from("profiles").select("is_president").eq("user_id", userUid).maybeSingle();
    assert("profiles · is_president unchanged after attempt", "false", String(!!p?.is_president));
  }

  // 7) Catalogue verifier RPC also passes for president
  {
    const r = await presClient.rpc("verify_rls_policies");
    if (r.error) {
      assert("rpc verify_rls_policies · president", "ok", `error: ${r.error.message}`);
    } else {
      const failed = (r.data || []).filter((x) => x.passed === false);
      assert(
        "rpc verify_rls_policies · president",
        "all checks passed",
        failed.length === 0 ? "all checks passed" : `${failed.length} failed`,
        failed.length ? JSON.stringify(failed.slice(0, 3)) : undefined,
      );
    }
  }

  // Report
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  const lines = [];
  lines.push("## RLS Integration Tests");
  lines.push("");
  lines.push(`- Total: **${results.length}**`);
  lines.push(`- ✅ Passed: **${passed}**`);
  lines.push(`- ❌ Failed: **${failed}**`);
  lines.push("");
  lines.push("| Scenario | Expected | Actual | Passed |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.expected} | ${r.actual} | ${r.passed ? "✅" : "❌"} |`);
  }
  writeFileSync("rls-report.md", lines.join("\n"));

  if (failed > 0) {
    console.error(`${failed} RLS assertion(s) failed`);
    process.exit(1);
  }
  console.log(`All ${passed} RLS assertions passed`);
}

main().catch((e) => {
  console.error(e);
  try {
    writeFileSync("rls-report.md", `## RLS Integration Tests\n\nFatal error: \`${e.message}\`\n`);
  } catch {}
  process.exit(1);
});
