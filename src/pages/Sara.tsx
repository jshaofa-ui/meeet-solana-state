import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageWrapper from "@/components/PageWrapper";
import { ShieldAlert, ShieldCheck, ShieldX, Activity, AlertTriangle, BarChart3, Loader2, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, LineChart, Line, Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Assessment {
  id: string;
  agent_id: string;
  action_ref: string;
  risk_score: number;
  risk_factors: { factor: string; weight: number; value: number }[];
  decision: string;
  mode: string;
  false_positive: boolean | null;
  created_at: string;
}

const decisionColors = { allow: "#4ade80", warn: "#facc15", block: "#f87171" };

const RISK_FACTOR_COLORS: Record<string, string> = {
  reputation: "#f87171",
  stake: "#facc15",
  velocity: "#fb923c",
  age: "#a78bfa",
  domain: "#38bdf8",
  time: "#34d399",
  default: "#94a3b8",
};

const Sara = () => {
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  // Real 30-day decisions timeline from sara_assessments
  const { data: decisionsOverTime = [] } = useQuery({
    queryKey: ["sara-decisions-30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("sara_assessments")
        .select("decision, created_at")
        .gte("created_at", since.toISOString())
        .limit(5000);
      const buckets: { date: string; allow: number; warn: number; block: number }[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        buckets.push({
          date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
          allow: 0, warn: 0, block: 0,
        });
      }
      (data ?? []).forEach((r: any) => {
        const day = Math.floor((new Date(r.created_at).getTime() - since.getTime()) / 86400000);
        if (day >= 0 && day < 30 && (r.decision in buckets[day])) {
          (buckets[day] as any)[r.decision] += 1;
        }
      });
      return buckets;
    },
  });

  // Real 12-week false-positive rate trend
  const { data: fpTrend = [] } = useQuery({
    queryKey: ["sara-fp-trend"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 12 * 7);
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("sara_assessments")
        .select("false_positive, created_at")
        .gte("created_at", since.toISOString())
        .limit(5000);
      const weeks: { week: string; total: number; fp: number }[] = [];
      for (let i = 0; i < 12; i++) weeks.push({ week: `W${i + 1}`, total: 0, fp: 0 });
      (data ?? []).forEach((r: any) => {
        const w = Math.floor((new Date(r.created_at).getTime() - since.getTime()) / (86400000 * 7));
        if (w >= 0 && w < 12) {
          weeks[w].total += 1;
          if (r.false_positive === true) weeks[w].fp += 1;
        }
      });
      return weeks.map(w => ({
        week: w.week,
        rate: w.total > 0 ? +((w.fp / w.total) * 100).toFixed(1) : 0,
      }));
    },
  });

  // Real risk factor breakdown aggregated from JSONB
  const { data: riskFactors = [] } = useQuery({
    queryKey: ["sara-risk-factors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sara_assessments")
        .select("risk_factors")
        .limit(2000);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
        factors.forEach((f: any) => {
          const name = String(f?.factor ?? "").trim();
          if (!name) return;
          counts.set(name, (counts.get(name) ?? 0) + 1);
        });
      });
      return Array.from(counts.entries())
        .map(([factor, count]) => ({
          factor,
          count,
          color: RISK_FACTOR_COLORS[factor.toLowerCase().split(" ")[0]] ?? RISK_FACTOR_COLORS.default,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["sara-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sara_assessments")
        .select("decision, risk_score, false_positive")
        .limit(1000);
      const rows = data || [];
      const total = rows.length;
      const allow = rows.filter(r => r.decision === "allow").length;
      const warn = rows.filter(r => r.decision === "warn").length;
      const block = rows.filter(r => r.decision === "block").length;
      const fp = rows.filter(r => r.false_positive === true).length;
      const avg = total > 0 ? rows.reduce((s, r) => s + r.risk_score, 0) / total : 0;
      const denom = total || 1;
      return {
        total,
        allow_count: allow,
        warn_count: warn,
        block_count: block,
        allow_pct: Math.round((allow / denom) * 100),
        warn_pct: Math.round((warn / denom) * 100),
        block_pct: Math.round((block / denom) * 100),
        false_positive_rate: Math.round((fp / denom) * 10000) / 100,
        avg_risk_score: Math.round(avg * 1000) / 1000,
      };
    },
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["sara-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sara_assessments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Assessment[];
    },
  });

  const { data: distData } = useQuery({
    queryKey: ["sara-distribution"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sara_assessments")
        .select("risk_score")
        .limit(1000);
      const buckets = Array.from({ length: 10 }, (_, i) => ({
        range: `${i * 10}-${(i + 1) * 10}%`,
        count: 0,
        color: i < 3 ? "#4ade80" : i < 6 ? "#facc15" : "#f87171",
      }));
      (data ?? []).forEach(r => {
        const idx = Math.min(Math.floor((r.risk_score ?? 0) * 10), 9);
        buckets[idx].count++;
      });
      return buckets;
    },
  });

  const { data: topAgents } = useQuery({
    queryKey: ["sara-top-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sara_assessments")
        .select("agent_id, risk_score, decision")
        .order("risk_score", { ascending: false })
        .limit(200);
      const map = new Map<string, { total: number; count: number; warns: number; blocks: number }>();
      (data ?? []).forEach(r => {
        const v = map.get(r.agent_id) || { total: 0, count: 0, warns: 0, blocks: 0 };
        v.total += r.risk_score;
        v.count++;
        if (r.decision === "warn") v.warns++;
        if (r.decision === "block") v.blocks++;
        map.set(r.agent_id, v);
      });
      return Array.from(map.entries())
        .map(([agent_id, v]) => ({
          agent_id,
          avg_risk: Math.round((v.total / v.count) * 100) / 100,
          count: v.count,
          warn_count: v.warns,
          block_count: v.blocks,
        }))
        .sort((a, b) => b.avg_risk - a.avg_risk)
        .slice(0, 20);
    },
  });

  const submitFeedback = async (id: string, fp: boolean) => {
    await supabase.from("sara_assessments").update({ false_positive: fp }).eq("id", id);
    setFeedbackId(null);
  };

  const statCards = [
    { label: "Total Assessments", value: stats?.total ?? 0, icon: Activity, color: "text-primary" },
    { label: "Allow", value: `${stats?.allow_pct ?? 0}%`, sub: stats?.allow_count, icon: ShieldCheck, color: "text-green-400" },
    { label: "Warn", value: `${stats?.warn_pct ?? 0}%`, sub: stats?.warn_count, icon: ShieldAlert, color: "text-yellow-400" },
    { label: "Block", value: `${stats?.block_pct ?? 0}%`, sub: stats?.block_count, icon: ShieldX, color: "text-red-400" },
    { label: "False Positive Rate", value: `${stats?.false_positive_rate ?? 0}%`, icon: AlertTriangle, color: "text-orange-400" },
    { label: "Avg Risk Score", value: stats?.avg_risk_score ?? 0, icon: TrendingUp, color: "text-blue-400" },
  ];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <PageWrapper>
      <div className="min-h-screen bg-background">
        <SEOHead title="SARA Guard — AI Risk Assessment | MEEET STATE" description="L2.5 guard: situational agent risk assessment for every AI agent action." path="/sara" />
        <Navbar />
        <main className="pt-20 pb-16">
          <div className="max-w-7xl mx-auto px-4">
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-4">
                <ShieldAlert className="w-3.5 h-3.5" /> L2.5 GUARD
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">SARA — Situational Agent Risk Assessment</h1>
              <p className="text-muted-foreground max-w-lg mx-auto">L2.5 guard between authorization and trust. Real-time scoring, chain verification, and anomaly detection.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              {statCards.map(s => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/30 transition-colors">
                  <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                  {"sub" in s && s.sub !== undefined && (
                    <p className="text-[9px] text-muted-foreground">{s.sub} total</p>
                  )}
                </div>
              ))}
            </div>

            {/* Row 1: Risk Distribution + Decisions Over Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-foreground">Risk Distribution</h2>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={distData || []}>
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(distData || []).map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-bold text-foreground mb-4">Decisions Over Time (30d)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={decisionsOverTime}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="allow" stackId="1" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="warn" stackId="1" stroke="#facc15" fill="#facc15" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="block" stackId="1" stroke="#f87171" fill="#f87171" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 2: False Positive Trend + Risk Factors Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-bold text-foreground mb-4">False Positive Trend (12 weeks)</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={fpTrend}>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="rate" stroke="#fb923c" strokeWidth={2} dot={{ r: 3, fill: "#fb923c" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-bold text-foreground mb-4">Risk Factors Breakdown</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={riskFactors} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="factor" type="category" width={110} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {riskFactors.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Risk Agents Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-bold text-foreground">Top Risk Agents</h2>
              </div>
              {topAgents && topAgents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left text-xs">
                        <th className="px-4 py-2.5">#</th>
                        <th className="px-4 py-2.5">Agent</th>
                        <th className="px-4 py-2.5">Avg Risk</th>
                        <th className="px-4 py-2.5">Assessments</th>
                        <th className="px-4 py-2.5">Warns</th>
                        <th className="px-4 py-2.5">Blocks</th>
                        <th className="px-4 py-2.5">Risk Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAgents.map((a, idx) => {
                        const pct = Math.round(a.avg_risk * 100);
                        const barColor = pct < 30 ? "bg-green-500" : pct < 60 ? "bg-yellow-500" : "bg-red-500";
                        return (
                          <tr key={a.agent_id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-foreground">{a.agent_id.slice(0, 12)}…</td>
                            <td className="px-4 py-2.5">
                              <span className={pct >= 60 ? "text-red-400 font-bold" : pct >= 30 ? "text-yellow-400" : "text-green-400"}>
                                {pct}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-foreground">{a.count}</td>
                            <td className="px-4 py-2.5 text-yellow-400">{a.warn_count}</td>
                            <td className="px-4 py-2.5 text-red-400">{a.block_count}</td>
                            <td className="px-4 py-2.5 w-32">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No agent data yet</p>
              )}
            </div>

            {/* Recent Assessments */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-foreground">Recent Assessments</h2>
                <Badge variant="outline" className="text-[10px]">Last 30</Badge>
              </div>
              {recentLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !recent || recent.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No assessments yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left text-xs">
                        <th className="px-4 py-2.5">Agent</th>
                        <th className="px-4 py-2.5">Action</th>
                        <th className="px-4 py-2.5">Score</th>
                        <th className="px-4 py-2.5">Decision</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(a => {
                        const pct = Math.round(a.risk_score * 100);
                        const dColor = decisionColors[a.decision as keyof typeof decisionColors] || "#888";
                        return (
                          <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.agent_id.slice(0, 8)}…</td>
                            <td className="px-4 py-2.5 text-foreground">{a.action_ref}</td>
                            <td className="px-4 py-2.5">
                              <span style={{ color: dColor }} className="font-bold">{pct}%</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${dColor}20`, color: dColor }}>
                                {a.decision.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5">
                              {a.false_positive === null ? (
                                feedbackId === a.id ? (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => submitFeedback(a.id, true)}>FP</Button>
                                    <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => submitFeedback(a.id, false)}>OK</Button>
                                  </div>
                                ) : (
                                  <button onClick={() => setFeedbackId(a.id)} className="text-[10px] text-primary hover:underline">Review</button>
                                )
                              ) : (
                                <span className={`text-[10px] ${a.false_positive ? "text-orange-400" : "text-green-400"}`}>
                                  {a.false_positive ? "FP" : "✓"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </PageWrapper>
  );
};

export default Sara;
