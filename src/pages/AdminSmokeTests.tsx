import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Shield, XCircle } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";

type SmokeRun = {
  id: string;
  ran_at: string;
  endpoint: string;
  status_code: number | null;
  ok: boolean;
  valid_json: boolean;
  duration_ms: number | null;
  error_message: string | null;
  request_id: string | null;
};

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

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return iso;
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

function classifyFailure(r: SmokeRun): "ok" | "shape" | "json" | "http" {
  if (r.ok && r.valid_json) return "ok";
  if (!r.valid_json) return "json";
  if (r.status_code && r.status_code >= 400) return "http";
  return "shape";
}

export default function AdminSmokeTests() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: isPresident, isLoading: checkLoading } = useAdminCheck();

  const [hours, setHours] = useState<number>(24);
  const [runs, setRuns] = useState<SmokeRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const fetchRuns = async (h: number) => {
    setRefreshing(true);
    setError(null);
    try {
      const since = new Date(Date.now() - h * 3600_000).toISOString();
      const { data, error: qErr } = await supabase
        .from("smoke_test_runs")
        .select("*")
        .gte("ran_at", since)
        .order("ran_at", { ascending: false })
        .limit(2000);
      if (qErr) throw new Error(qErr.message);
      setRuns((data ?? []) as SmokeRun[]);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load smoke-test runs";
      setError(msg);
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isPresident) fetchRuns(hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresident]);

  // Per-endpoint latest status + failure counts
  const endpoints = useMemo(() => {
    const map = new Map<string, {
      endpoint: string;
      latest: SmokeRun;
      total: number;
      failures: number;
      json_errors: number;
      shape_errors: number;
      http_errors: number;
      avg_ms: number;
    }>();
    for (const r of runs ?? []) {
      const cur = map.get(r.endpoint);
      const cls = classifyFailure(r);
      if (!cur) {
        map.set(r.endpoint, {
          endpoint: r.endpoint,
          latest: r,
          total: 1,
          failures: cls === "ok" ? 0 : 1,
          json_errors: cls === "json" ? 1 : 0,
          shape_errors: cls === "shape" ? 1 : 0,
          http_errors: cls === "http" ? 1 : 0,
          avg_ms: r.duration_ms ?? 0,
        });
      } else {
        cur.total += 1;
        if (cls !== "ok") cur.failures += 1;
        if (cls === "json") cur.json_errors += 1;
        if (cls === "shape") cur.shape_errors += 1;
        if (cls === "http") cur.http_errors += 1;
        cur.avg_ms = ((cur.avg_ms * (cur.total - 1)) + (r.duration_ms ?? 0)) / cur.total;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.failures - a.failures || a.endpoint.localeCompare(b.endpoint));
  }, [runs]);

  // Failures over time — bucket by hour, count failures per endpoint
  const chartData = useMemo(() => {
    if (!runs || runs.length === 0) return { rows: [] as any[], keys: [] as string[] };
    const bucketMs = hours <= 6 ? 5 * 60_000 : hours <= 48 ? 60 * 60_000 : 6 * 60 * 60_000;
    const keys = Array.from(new Set(runs.map((r) => r.endpoint))).sort();
    const buckets = new Map<number, Record<string, any>>();
    for (const r of runs) {
      if (classifyFailure(r) === "ok") continue;
      const t = Math.floor(new Date(r.ran_at).getTime() / bucketMs) * bucketMs;
      const row = buckets.get(t) ?? { t };
      row[r.endpoint] = (row[r.endpoint] ?? 0) + 1;
      buckets.set(t, row);
    }
    const rows = Array.from(buckets.values())
      .sort((a, b) => a.t - b.t)
      .map((r) => ({
        ...r,
        label: new Date(r.t).toLocaleString(undefined, {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        }),
      }));
    // Ensure each row has 0 for missing keys for cleaner lines
    for (const r of rows) for (const k of keys) if (r[k] == null) r[k] = 0;
    return { rows, keys };
  }, [runs, hours]);

  const totals = useMemo(() => {
    const all = runs ?? [];
    const failures = all.filter((r) => classifyFailure(r) !== "ok").length;
    return {
      runs: all.length,
      failures,
      success_pct: all.length ? Math.round(((all.length - failures) / all.length) * 1000) / 10 : 100,
      endpoints: endpoints.length,
    };
  }, [runs, endpoints]);

  if (loading || checkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isPresident) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-24">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                President access required
              </CardTitle>
              <CardDescription>
                Only the president account can view smoke-test results.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Distinct line colors using semantic tokens via inline HSL refs to chart palette
  const lineColors = [
    "hsl(var(--primary))",
    "hsl(var(--destructive))",
    "hsl(217 91% 60%)",
    "hsl(142 71% 45%)",
    "hsl(38 92% 50%)",
    "hsl(280 70% 60%)",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              Smoke Tests
            </h1>
            <p className="text-muted-foreground">
              Latest synthetic checks against critical edge functions, with JSON/shape validation and failure trend.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="hours" className="text-sm text-muted-foreground">
              Window (hours)
            </label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={(e) => setHours(Math.max(1, Math.min(168, Number(e.target.value) || 1)))}
              className="w-24"
            />
            <Button onClick={() => fetchRuns(hours)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Endpoints</CardDescription>
              <CardTitle className="text-3xl">{totals.endpoints}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total runs</CardDescription>
              <CardTitle className="text-3xl">{totals.runs.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failures</CardDescription>
              <CardTitle className="text-3xl text-destructive">{totals.failures.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Success rate</CardDescription>
              <CardTitle className="text-3xl">{totals.success_pct}%</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Could not load smoke-test runs
              </CardTitle>
              <CardDescription className="break-words">{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Per-endpoint status</CardTitle>
            <CardDescription>
              Latest result and failure counts in the selected window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {endpoints.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No smoke-test runs in this window yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Latest</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Failures</TableHead>
                      <TableHead className="text-right">JSON</TableHead>
                      <TableHead className="text-right">Shape</TableHead>
                      <TableHead className="text-right">HTTP</TableHead>
                      <TableHead className="text-right">Avg ms</TableHead>
                      <TableHead>Last error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.map((e) => {
                      const cls = classifyFailure(e.latest);
                      return (
                        <TableRow key={e.endpoint}>
                          <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {cls === "ok" ? (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-primary" /> OK
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  {cls === "json" ? "Invalid JSON" : cls === "shape" ? "Bad shape" : `HTTP ${e.latest.status_code ?? "?"}`}
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelative(e.latest.ran_at)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{e.total}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {e.failures > 0 ? <Badge variant="destructive">{e.failures}</Badge> : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell className="text-right">{e.json_errors}</TableCell>
                          <TableCell className="text-right">{e.shape_errors}</TableCell>
                          <TableCell className="text-right">{e.http_errors}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {Math.round(e.avg_ms)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {e.latest.error_message ? (
                              <p className="text-xs font-mono break-words line-clamp-2">
                                {e.latest.error_message}
                              </p>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failures over time</CardTitle>
            <CardDescription>
              Bucketed failure count per endpoint (
              {hours <= 6 ? "5-minute buckets" : hours <= 48 ? "hourly buckets" : "6-hour buckets"}
              ).
            </CardDescription>
          </CardHeader>
          <CardContent style={{ height: 360 }}>
            {chartData.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                🎉 No failures recorded in this window.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chartData.keys.map((k, i) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={lineColors[i % lineColors.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Most recent 100 smoke-test executions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">HTTP</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs ?? []).slice(0, 100).map((r) => {
                    const cls = classifyFailure(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelative(r.ran_at)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.endpoint}</TableCell>
                        <TableCell>
                          {cls === "ok" ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3 text-primary" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              {cls === "json" ? "Invalid JSON" : cls === "shape" ? "Bad shape" : "HTTP error"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs">{r.status_code ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{r.duration_ms ?? "—"}</TableCell>
                        <TableCell className="max-w-md">
                          {r.error_message ? (
                            <p className="text-xs font-mono break-words line-clamp-2">{r.error_message}</p>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
