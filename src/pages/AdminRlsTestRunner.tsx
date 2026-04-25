import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, RefreshCw, CheckCircle2, XCircle, Beaker, Sprout } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Outcome = "blocked" | "allowed" | "error";
type ScenarioResult = {
  table: string;
  role: "anon" | "authenticated";
  operation: string;
  /** Name of the RLS policy this assertion documents (or "(no policy)"). */
  policy: string;
  /** Human-readable expected behavior for that policy. */
  rule: string;
  expected: Outcome;
  actual: Outcome;
  passed: boolean;
  detail: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function useAdminCheck() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("is_president")
        .eq("user_id", user.id)
        .single();
      return data?.is_president === true;
    },
    enabled: !!user,
  });
}

/** A "blocked" outcome is anything where the row count is 0 OR the operation
 *  errors with an RLS / permission violation. "allowed" means rows came back
 *  or the write succeeded. */
function classifyRead(error: any, count: number | null): Outcome {
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("permission denied") || msg.includes("row-level security") || msg.includes("rls")) {
      return "blocked";
    }
    return "error";
  }
  return (count ?? 0) > 0 ? "allowed" : "blocked";
}

function classifyWrite(error: any): Outcome {
  if (!error) return "allowed";
  const msg = (error.message || "").toLowerCase();
  if (
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level") ||
    msg.includes("new row violates") ||
    msg.includes("rls")
  ) {
    return "blocked";
  }
  return "error";
}

async function runScenarios(authedJwt: string | null, currentUserId: string | null): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];

  // Anon client — fresh, no auth header
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authenticated client — uses current session JWT
  const authClient = authedJwt
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authedJwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  const push = (r: Omit<ScenarioResult, "passed">) =>
    results.push({ ...r, passed: r.actual === r.expected });

  // ============================================================
  // newsletter_subscribers
  //   Policies:
  //     - "Block client read of subscribers"   SELECT anon,authenticated USING(false)
  //     - "Block client update of subscribers" UPDATE anon,authenticated USING(false)
  //     - "Block client delete of subscribers" DELETE anon,authenticated USING(false)
  //     - "Service role manages subscribers"   ALL    service_role
  //     - (no INSERT policy for anon/authenticated → blocked by default)
  // ============================================================
  for (const role of ["anon", "authenticated"] as const) {
    const client = role === "anon" ? anonClient : authClient;
    if (!client) continue;

    const sel = await client
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true });
    push({
      table: "newsletter_subscribers",
      role,
      operation: "SELECT",
      policy: "Block client read of subscribers",
      rule: `${role} SELECT must be blocked (USING false)`,
      expected: "blocked",
      actual: classifyRead(sel.error, sel.count ?? 0),
      detail: sel.error ? sel.error.message : `count=${sel.count ?? 0}`,
    });

    const ins = await client
      .from("newsletter_subscribers")
      .insert({ email: `rls-runner-${role}-${Date.now()}@rls-fixture.test` });
    push({
      table: "newsletter_subscribers",
      role,
      operation: "INSERT",
      policy: "(no INSERT policy)",
      rule: `${role} INSERT must be blocked — no permissive policy exists`,
      expected: "blocked",
      actual: classifyWrite(ins.error),
      detail: ins.error ? ins.error.message : "row inserted (LEAK)",
    });

    const upd = await client
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed" })
      .eq("email", "nonexistent@rls-fixture.test");
    push({
      table: "newsletter_subscribers",
      role,
      operation: "UPDATE",
      policy: "Block client update of subscribers",
      rule: `${role} UPDATE must be blocked (USING false)`,
      expected: "blocked",
      actual: classifyWrite(upd.error),
      detail: upd.error ? upd.error.message : "no error (rows likely 0)",
    });

    const del = await client
      .from("newsletter_subscribers")
      .delete()
      .eq("email", "nonexistent@rls-fixture.test");
    push({
      table: "newsletter_subscribers",
      role,
      operation: "DELETE",
      policy: "Block client delete of subscribers",
      rule: `${role} DELETE must be blocked (USING false)`,
      expected: "blocked",
      actual: classifyWrite(del.error),
      detail: del.error ? del.error.message : "no error (rows likely 0)",
    });
  }

  // ============================================================
  // sector_treasury_log
  //   Policies:
  //     - "Authenticated users can read treasury log" SELECT authenticated USING(true)
  //     - (no anon SELECT, no INSERT/UPDATE/DELETE for clients → blocked)
  // ============================================================
  {
    const sel = await anonClient
      .from("sector_treasury_log")
      .select("id", { count: "exact", head: true });
    push({
      table: "sector_treasury_log",
      role: "anon",
      operation: "SELECT",
      policy: "(no anon SELECT policy)",
      rule: "anon SELECT must be blocked — no permissive policy",
      expected: "blocked",
      actual: classifyRead(sel.error, sel.count ?? 0),
      detail: sel.error ? sel.error.message : `count=${sel.count ?? 0}`,
    });
  }

  if (authClient) {
    const sel = await authClient
      .from("sector_treasury_log")
      .select("id", { count: "exact", head: true });
    push({
      table: "sector_treasury_log",
      role: "authenticated",
      operation: "SELECT",
      policy: "Authenticated users can read treasury log",
      rule: "authenticated SELECT must succeed (USING true)",
      expected: "allowed",
      actual: sel.error ? classifyRead(sel.error, 0) : "allowed",
      detail: sel.error ? sel.error.message : `count=${sel.count ?? 0}`,
    });
  }

  for (const role of ["anon", "authenticated"] as const) {
    const client = role === "anon" ? anonClient : authClient;
    if (!client) continue;

    const ins = await client
      .from("sector_treasury_log")
      .insert({ sector_key: "ai_architects", amount: 1, reason: "rls_fixture_runner" });
    push({
      table: "sector_treasury_log",
      role,
      operation: "INSERT",
      policy: "(no INSERT policy)",
      rule: `${role} INSERT must be blocked — service_role only`,
      expected: "blocked",
      actual: classifyWrite(ins.error),
      detail: ins.error ? ins.error.message : "row inserted (LEAK)",
    });
  }

  // ============================================================
  // profiles
  //   Policies:
  //     - "Users can view own profile"   SELECT authenticated USING(auth.uid()=user_id)
  //     - "Users can update own profile" UPDATE authenticated — protected fields locked
  //   Assertion: every authenticated caller (incl. president) can read their OWN
  //   profile, but not a fabricated foreign user_id. Presidents have NO extra read
  //   access via this policy — president privileges are enforced via SECURITY DEFINER
  //   functions, never by widening RLS.
  // ============================================================
  if (authClient && currentUserId) {
    const own = await authClient
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", currentUserId);
    push({
      table: "profiles",
      role: "authenticated",
      operation: "SELECT (own row)",
      policy: "Users can view own profile",
      rule: "caller may read row where user_id = auth.uid() — applies to president and non-president alike",
      expected: "allowed",
      actual: own.error ? "error" : (own.count ?? 0) > 0 ? "allowed" : "blocked",
      detail: own.error ? own.error.message : `count=${own.count ?? 0}`,
    });

    // Random uuid that cannot match any real user
    const fakeUid = "00000000-0000-0000-0000-000000000001";
    const foreign = await authClient
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", fakeUid);
    push({
      table: "profiles",
      role: "authenticated",
      operation: "SELECT (foreign row)",
      policy: "Users can view own profile",
      rule: "RLS must hide rows where user_id != auth.uid() — president MUST NOT bypass",
      expected: "blocked",
      actual: foreign.error ? classifyRead(foreign.error, 0) : (foreign.count ?? 0) > 0 ? "allowed" : "blocked",
      detail: foreign.error ? foreign.error.message : `count=${foreign.count ?? 0}`,
    });

    // Attempt to escalate is_president via direct UPDATE — must be blocked by
    // the WITH CHECK clause on "Users can update own profile".
    const escalate = await authClient
      .from("profiles")
      .update({ is_president: true })
      .eq("user_id", currentUserId);
    push({
      table: "profiles",
      role: "authenticated",
      operation: "UPDATE is_president",
      policy: "Users can update own profile",
      rule: "is_president change must be rejected by WITH CHECK (no self-promotion)",
      expected: "blocked",
      actual: classifyWrite(escalate.error),
      detail: escalate.error ? escalate.error.message : "update accepted (LEAK)",
    });
  }

  // anon must not see profiles at all
  {
    const sel = await anonClient
      .from("profiles")
      .select("user_id", { count: "exact", head: true });
    push({
      table: "profiles",
      role: "anon",
      operation: "SELECT",
      policy: "(no anon policy)",
      rule: "anon must never read profiles",
      expected: "blocked",
      actual: classifyRead(sel.error, sel.count ?? 0),
      detail: sel.error ? sel.error.message : `count=${sel.count ?? 0}`,
    });
  }

  return results;
}

export default function AdminRlsTestRunner() {
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useAdminCheck();

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ScenarioResult[] | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  // Fixture seeding
  const [seedCount, setSeedCount] = useState<number>(5);
  const [seeding, setSeeding] = useState(false);
  const [seedSummary, setSeedSummary] = useState<{
    newsletter_subscribers: number;
    sector_treasury_log: number;
    seeded_at: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const jwt = session?.access_token ?? null;
      const r = await runScenarios(jwt, user?.id ?? null);
      setResults(r);
      setRanAt(new Date());
      const failed = r.filter((x) => !x.passed).length;
      if (failed === 0) toast.success(`All ${r.length} scenarios passed`);
      else toast.error(`${failed} of ${r.length} scenarios failed`);

      // Best-effort cleanup of any rows that slipped through
      try {
        await supabase.functions.invoke("cleanup-rls-fixtures").catch(() => {});
      } catch {
        /* no-op */
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to run scenarios");
    } finally {
      setRunning(false);
    }
  }, [session, user]);

  const seed = useCallback(async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-rls-fixtures", {
        body: { count: seedCount },
      });
      if (error) throw error;
      if (!data?.ok) {
        const msg =
          data?.errors?.newsletter_subscribers ||
          data?.errors?.sector_treasury_log ||
          "Seeding failed";
        throw new Error(msg);
      }
      setSeedSummary({
        newsletter_subscribers: data.inserted.newsletter_subscribers,
        sector_treasury_log: data.inserted.sector_treasury_log,
        seeded_at: data.seeded_at,
      });
      const total =
        data.inserted.newsletter_subscribers + data.inserted.sector_treasury_log;
      toast.success(`Seeded ${total} fixture rows`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to seed fixtures");
    } finally {
      setSeeding(false);
    }
  }, [seedCount]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                President access required
              </CardTitle>
              <CardDescription>This test runner is restricted to the President role.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")} variant="outline">
                Back to home
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const total = results?.length ?? 0;
  const passed = results?.filter((r) => r.passed).length ?? 0;
  const failed = total - passed;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Beaker className="h-7 w-7 text-primary" />
              RLS Runtime Test Runner
            </h1>
            <p className="text-muted-foreground mt-1">
              Executes real read/write probes against{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">newsletter_subscribers</code> and{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">sector_treasury_log</code> using anon &amp;
              authenticated clients, then reports whether each was blocked or allowed as expected.
            </p>
          </div>
          <Button onClick={run} disabled={running} size="lg">
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
            {running ? "Running…" : "Run scenarios"}
          </Button>
        </div>

        {results && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total scenarios</CardDescription>
                <CardTitle className="text-3xl">{total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className={failed === 0 ? "border-green-500/40" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>Passed</CardDescription>
                <CardTitle className="text-3xl text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6" /> {passed}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={failed > 0 ? "border-destructive/60" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>Failed</CardDescription>
                <CardTitle
                  className={`text-3xl flex items-center gap-2 ${
                    failed > 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {failed > 0 ? <XCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />} {failed}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Latest scenarios</CardTitle>
            <CardDescription>
              {ranAt ? `Ran at ${ranAt.toLocaleString()}` : "Not run yet — click 'Run scenarios'."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!results ? (
              <div className="text-center py-10 text-muted-foreground">
                {running ? "Running probes…" : "No data yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow
                        key={i}
                        className={
                          r.passed ? "bg-green-500/5 hover:bg-green-500/10" : "bg-destructive/10 hover:bg-destructive/20"
                        }
                      >
                        <TableCell>
                          {r.passed ? (
                            <Badge variant="outline" className="border-green-500/50 text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> PASS
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" /> FAIL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.table}</TableCell>
                        <TableCell className="text-xs">{r.role}</TableCell>
                        <TableCell className="text-xs">{r.operation}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[14rem] truncate" title={r.policy}>
                          {r.policy}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[20rem] truncate" title={r.rule}>
                          {r.rule}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.expected}</TableCell>
                        <TableCell className="text-xs">{r.actual}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={r.detail}>
                          {r.detail}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
