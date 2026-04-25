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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AlertTriangle, RefreshCw, Shield, Activity } from "lucide-react";
import { toast } from "sonner";

type EdgeFailure = {
  function_id: string;
  function_name: string;
  count_4xx: number;
  count_5xx: number;
  total_failures: number;
  last_failure_at: string | null;
  last_error: {
    status: number;
    method: string;
    message: string;
    at: string;
  } | null;
};

type ApiResponse = {
  ok: boolean;
  window_hours: number;
  since: string;
  generated_at: string;
  total_failing_functions: number;
  functions: EdgeFailure[];
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

export default function AdminEdgeFailures() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: isPresident, isLoading: checkLoading } = useAdminCheck();

  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const fetchFailures = async (h: number) => {
    setRefreshing(true);
    setError(null);
    try {
      const { data: resp, error: invokeErr } = await supabase.functions.invoke<ApiResponse>(
        "admin-edge-failures",
        { body: { hours: h } },
      );
      if (invokeErr) throw new Error(invokeErr.message);
      if (!resp?.ok) throw new Error("Edge function returned an unexpected response");
      setData(resp);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load edge failures";
      setError(msg);
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isPresident) fetchFailures(hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresident]);

  const totals = useMemo(() => {
    const fns = data?.functions ?? [];
    return {
      functions: fns.length,
      count_4xx: fns.reduce((a, f) => a + f.count_4xx, 0),
      count_5xx: fns.reduce((a, f) => a + f.count_5xx, 0),
    };
  }, [data]);

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
                Only the president account can view edge function failure analytics.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              Edge Function Failures
            </h1>
            <p className="text-muted-foreground">
              4xx/5xx error counts and last error per function over the selected window.
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
            <Button
              onClick={() => fetchFailures(hours)}
              disabled={refreshing}
              variant="default"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failing functions</CardDescription>
              <CardTitle className="text-3xl">{totals.functions}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>4xx responses</CardDescription>
              <CardTitle className="text-3xl">{totals.count_4xx.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>5xx responses</CardDescription>
              <CardTitle className="text-3xl text-destructive">
                {totals.count_5xx.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Could not load failures
              </CardTitle>
              <CardDescription className="break-words">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The <code>admin-edge-failures</code> function requires{" "}
                <code>SUPABASE_ACCESS_TOKEN</code> and <code>SUPABASE_PROJECT_REF</code> to be
                configured in edge function secrets so it can query the analytics API.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Failures by function</CardTitle>
            <CardDescription>
              {data
                ? `Window: last ${data.window_hours}h · Generated ${formatRelative(data.generated_at)}`
                : "Loading…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.functions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                🎉 No edge function failures in this window.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Function</TableHead>
                      <TableHead className="text-right">4xx</TableHead>
                      <TableHead className="text-right">5xx</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Last failure</TableHead>
                      <TableHead>Last error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.functions ?? []).map((f) => (
                      <TableRow key={f.function_id}>
                        <TableCell className="font-mono text-xs">
                          {f.function_name}
                          {f.function_name !== f.function_id && (
                            <div className="text-[10px] text-muted-foreground">
                              {f.function_id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {f.count_4xx > 0 ? (
                            <Badge variant="secondary">{f.count_4xx}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {f.count_5xx > 0 ? (
                            <Badge variant="destructive">{f.count_5xx}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {f.total_failures}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(f.last_failure_at)}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {f.last_error ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={f.last_error.status >= 500 ? "destructive" : "secondary"}
                                >
                                  {f.last_error.method} {f.last_error.status}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatRelative(f.last_error.at)}
                                </span>
                              </div>
                              <p className="text-xs font-mono break-words line-clamp-3">
                                {f.last_error.message || "(no message)"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
