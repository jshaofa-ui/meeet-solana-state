import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, RefreshCw, CheckCircle2, XCircle, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type RlsRow = {
  table_name: string;
  role_tested: string;
  operation: string;
  expected: string;
  actual: string;
  passed: boolean;
};

type RunRecord = {
  ranAt: Date;
  rows: RlsRow[];
  failed: number;
  total: number;
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

const STORAGE_KEY = "rls_audit_history_v1";

function loadHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<RunRecord, "ranAt"> & { ranAt: string }>;
    return parsed.map((r) => ({ ...r, ranAt: new Date(r.ranAt) }));
  } catch {
    return [];
  }
}

function saveHistory(history: RunRecord[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history.slice(0, 20).map((r) => ({ ...r, ranAt: r.ranAt.toISOString() })))
    );
  } catch {
    // ignore quota errors
  }
}

export default function AdminRlsAudit() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useAdminCheck();

  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<RunRecord | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);

  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    if (h[0]) setLatest(h[0]);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc("verify_rls_policies" as any);
      if (error) throw error;
      const rows = (data ?? []) as RlsRow[];
      const failed = rows.filter((r) => !r.passed).length;
      const record: RunRecord = {
        ranAt: new Date(),
        rows,
        failed,
        total: rows.length,
      };
      setLatest(record);
      const next = [record, ...history].slice(0, 20);
      setHistory(next);
      saveHistory(next);
      if (failed === 0) {
        toast.success(`All ${rows.length} RLS checks passed`);
      } else {
        toast.error(`${failed} of ${rows.length} RLS checks failed`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to run RLS audit");
    } finally {
      setRunning(false);
    }
  }, [history]);

  const rowKey = (r: RlsRow) => `${r.table_name}|${r.role_tested}|${r.operation}`;

  const computeDiff = useCallback((current: RunRecord, previous: RunRecord | null) => {
    if (!previous) {
      return { newFailures: [] as RlsRow[], newlyFixed: [] as RlsRow[], stillFailing: current.rows.filter((r) => !r.passed), baseline: null as RunRecord | null };
    }
    const prevMap = new Map(previous.rows.map((r) => [rowKey(r), r]));
    const newFailures: RlsRow[] = [];
    const newlyFixed: RlsRow[] = [];
    const stillFailing: RlsRow[] = [];
    for (const r of current.rows) {
      const p = prevMap.get(rowKey(r));
      if (!r.passed && (!p || p.passed)) newFailures.push(r);
      else if (r.passed && p && !p.passed) newlyFixed.push(r);
      else if (!r.passed) stillFailing.push(r);
    }
    return { newFailures, newlyFixed, stillFailing, baseline: previous };
  }, []);

  const downloadPdf = useCallback(() => {
    if (!latest) {
      toast.error("Run an audit first");
      return;
    }
    const lastSuccess = history.find((h, i) => i > 0 ? h.ranAt < latest.ranAt && h.failed === 0 : false)
      ?? history.slice(1).find((h) => h.failed === 0)
      ?? null;
    const diff = computeDiff(latest, lastSuccess);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = margin;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RLS Policy Audit Report", margin, y);
    y += 22;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 14;
    doc.text(`Audit run at: ${latest.ranAt.toLocaleString()}`, margin, y);
    y += 18;

    // Summary box
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total checks: ${latest.total}`, margin, y); y += 12;
    doc.setTextColor(0, 130, 0);
    doc.text(`Passed: ${latest.total - latest.failed}`, margin, y); y += 12;
    doc.setTextColor(latest.failed > 0 ? 200 : 100, 0, 0);
    doc.text(`Failed: ${latest.failed}`, margin, y); y += 16;
    doc.setTextColor(0, 0, 0);

    // Diff section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Changes since last successful run", margin, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (!lastSuccess) {
      doc.text("No prior successful run found in local history.", margin, y);
      y += 14;
    } else {
      doc.text(`Baseline: ${lastSuccess.ranAt.toLocaleString()} (${lastSuccess.total} checks, all passed)`, margin, y);
      y += 14;
      doc.setTextColor(180, 0, 0);
      doc.text(`New failures: ${diff.newFailures.length}`, margin, y); y += 12;
      doc.setTextColor(0, 130, 0);
      doc.text(`Newly fixed: ${diff.newlyFixed.length}`, margin, y); y += 12;
      doc.setTextColor(150, 100, 0);
      doc.text(`Still failing: ${diff.stillFailing.length}`, margin, y); y += 14;
      doc.setTextColor(0, 0, 0);
    }

    const renderTable = (title: string, rows: RlsRow[], color: [number, number, number]) => {
      if (rows.length === 0) return;
      autoTable(doc, {
        startY: y + 4,
        head: [[title]],
        body: [],
        theme: "plain",
        headStyles: { fillColor: color, textColor: 255, fontStyle: "bold", fontSize: 10 },
        margin: { left: margin, right: margin },
      });
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY,
        head: [["Table", "Role", "Operation", "Expected", "Actual"]],
        body: rows.map((r) => [r.table_name, r.role_tested, r.operation, r.expected, r.actual]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [40, 40, 40] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    };

    renderTable("New failures", diff.newFailures, [180, 30, 30]);
    renderTable("Newly fixed", diff.newlyFixed, [30, 130, 30]);
    renderTable("Still failing", diff.stillFailing, [180, 120, 0]);

    // Full results
    autoTable(doc, {
      startY: y + 4,
      head: [["Status", "Table", "Role", "Operation", "Expected", "Actual"]],
      body: latest.rows.map((r) => [
        r.passed ? "PASS" : "FAIL",
        r.table_name,
        r.role_tested,
        r.operation,
        r.expected,
        r.actual,
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [40, 40, 40] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const passed = data.cell.raw === "PASS";
          data.cell.styles.textColor = passed ? [0, 130, 0] : [200, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        const str = `Page ${(doc as any).internal.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(str, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      },
    });

    const fname = `rls-audit-${latest.ranAt.toISOString().replace(/[:.]/g, "-")}.pdf`;
    doc.save(fname);
    toast.success("PDF report downloaded");
  }, [latest, history, computeDiff]);

  // Auto-run once on mount when admin

  useEffect(() => {
    if (isAdmin && !latest && !running) {
      runAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          Loading…
        </div>
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
              <CardDescription>
                This audit panel is restricted to the President role.
              </CardDescription>
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              RLS Policy Audit
            </h1>
            <p className="text-muted-foreground mt-1">
              Runs <code className="text-xs bg-muted px-1 py-0.5 rounded">verify_rls_policies()</code> and reports per-row pass/fail status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadPdf} disabled={!latest} variant="outline" size="lg">
              <FileDown className="h-4 w-4 mr-2" />
              Download PDF report
            </Button>
            <Button onClick={runAudit} disabled={running} size="lg">
              <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
              {running ? "Running…" : "Run audit now"}
            </Button>
          </div>
        </div>

        {latest && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total checks</CardDescription>
                <CardTitle className="text-3xl">{latest.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className={latest.failed === 0 ? "border-green-500/40" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>Passed</CardDescription>
                <CardTitle className="text-3xl text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6" />
                  {latest.total - latest.failed}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={latest.failed > 0 ? "border-destructive/60" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>Failed</CardDescription>
                <CardTitle className={`text-3xl flex items-center gap-2 ${latest.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {latest.failed > 0 ? <XCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                  {latest.failed}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Latest run</CardTitle>
            <CardDescription>
              {latest
                ? `Ran at ${latest.ranAt.toLocaleString()}`
                : "No runs yet — click 'Run audit now'."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latest ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latest.rows.map((r, i) => (
                      <TableRow
                        key={i}
                        className={
                          r.passed
                            ? "bg-green-500/5 hover:bg-green-500/10"
                            : "bg-destructive/10 hover:bg-destructive/20"
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
                        <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                        <TableCell className="text-xs">{r.role_tested}</TableCell>
                        <TableCell className="text-xs">{r.operation}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.expected}</TableCell>
                        <TableCell className="text-xs">{r.actual}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                {running ? "Running…" : "No data yet."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run history</CardTitle>
            <CardDescription>Last {history.length} run(s) — stored locally in this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground">No history yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Passed</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow
                      key={i}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setLatest(h)}
                    >
                      <TableCell className="text-xs font-mono">{h.ranAt.toLocaleString()}</TableCell>
                      <TableCell>{h.total}</TableCell>
                      <TableCell className="text-green-600">{h.total - h.failed}</TableCell>
                      <TableCell className={h.failed > 0 ? "text-destructive font-semibold" : ""}>
                        {h.failed}
                      </TableCell>
                      <TableCell>
                        {h.failed === 0 ? (
                          <Badge variant="outline" className="border-green-500/50 text-green-600">
                            All passed
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {h.failed} failed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
