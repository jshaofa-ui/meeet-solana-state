import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useLanguage } from "@/i18n/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Brain, Users, TrendingUp, Activity, Crown, Medal, Award } from "lucide-react";
import { LLM_MODELS, MODEL_LIST, type ModelId, type LLMModel } from "@/config/models";

// ─── Types ──────────────────────────────────────────────────────────
interface ModelStats {
  model: ModelId;
  cfg: LLMModel;
  agentCount: number;
  avgWinRate: number;       // 0..1
  avgLearning: number;      // 0..100
  totalInteractions: number;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt0 = (v: number) => Math.round(v).toLocaleString();

// Floating particle for hero background
const Particle = ({ color, delay, x }: { color: string; delay: number; x: number }) => (
  <motion.div
    className="absolute w-2 h-2 rounded-full blur-[1px]"
    style={{ backgroundColor: color, left: `${x}%`, bottom: 0 }}
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: -600, opacity: [0, 0.7, 0] }}
    transition={{ duration: 8, delay, repeat: Infinity, ease: "linear" }}
  />
);

// ─── Page ───────────────────────────────────────────────────────────
const Models = () => {
  const { t, lang } = useLanguage();
  const [hiddenModels, setHiddenModels] = useState<Set<ModelId>>(new Set());

  const { data: stats = [], isLoading } = useQuery<ModelStats[]>({
    queryKey: ["model-leaderboard"],
    queryFn: async () => {
      // Тянем агентов и группируем на клиенте — компактно и не требует RPC.
      const { data, error } = await supabase
        .from("agents_public" as any)
        .select("llm_model, win_rate, learning_score, interaction_count")
        .limit(5000);
      if (error) throw error;

      const buckets = new Map<ModelId, { wins: number[]; learn: number[]; interact: number; count: number }>();
      for (const m of MODEL_LIST) {
        buckets.set(m.id, { wins: [], learn: [], interact: 0, count: 0 });
      }
      for (const row of (data ?? []) as any[]) {
        const id = (row.llm_model as ModelId) ?? "gpt-4o";
        const b = buckets.get(id) ?? buckets.get("gpt-4o")!;
        b.wins.push(Number(row.win_rate ?? 0.5));
        b.learn.push(Number(row.learning_score ?? 0));
        b.interact += Number(row.interaction_count ?? 0);
        b.count += 1;
      }
      const result: ModelStats[] = MODEL_LIST.map((cfg) => {
        const b = buckets.get(cfg.id)!;
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : 0);
        return {
          model: cfg.id,
          cfg,
          agentCount: b.count,
          avgWinRate: avg(b.wins),
          avgLearning: avg(b.learn),
          totalInteractions: b.interact,
        };
      });
      return result.sort((a, b) => b.avgWinRate - a.avgWinRate);
    },
    staleTime: 60_000,
  });

  const totalAgents = useMemo(() => stats.reduce((s, x) => s + x.agentCount, 0), [stats]);
  const maxInteractions = useMemo(
    () => Math.max(1, ...stats.map((s) => s.totalInteractions)),
    [stats],
  );
  const maxAgents = useMemo(() => Math.max(1, ...stats.map((s) => s.agentCount)), [stats]);

  // ─── Radar data ──────────────────────────────────────────────────
  const radarAxes = [
    { key: "winRate",     label: t("models.axisWin") },
    { key: "learning",    label: t("models.axisLearn") },
    { key: "agents",      label: t("models.axisAgents") },
    { key: "interactions",label: t("models.axisInteractions") },
    { key: "consistency", label: t("models.axisConsistency") },
  ];

  // For each axis, compute 0..100 normalized value per model
  const radarData = radarAxes.map((axis) => {
    const row: Record<string, any> = { axis: axis.label };
    for (const s of stats) {
      let v = 0;
      switch (axis.key) {
        case "winRate":      v = s.avgWinRate * 100; break;
        case "learning":     v = s.avgLearning; break;
        case "agents":       v = (s.agentCount / maxAgents) * 100; break;
        case "interactions": v = (s.totalInteractions / maxInteractions) * 100; break;
        case "consistency":  v = 50 + (s.avgWinRate - 0.5) * 100; break; // proxy
      }
      row[s.cfg.name] = Number(v.toFixed(1));
    }
    return row;
  });

  const toggleModel = (id: ModelId) => {
    setHiddenModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Pie / Donut data ────────────────────────────────────────────
  const pieData = stats
    .filter((s) => s.agentCount > 0)
    .map((s) => ({ name: s.cfg.name, value: s.agentCount, color: s.cfg.color }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title={t("models.seoTitle")}
        description={t("models.seoDesc")}
        path="/models"
      />
      <Navbar />

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/5" />
          {/* Floating particles in model colors */}
          <div className="absolute inset-0 pointer-events-none">
            {MODEL_LIST.map((m, i) => (
              <Particle key={m.id} color={m.color} delay={i * 1.0} x={(i * 13) % 100} />
            ))}
          </div>
          <div className="relative container mx-auto px-4 py-16 md:py-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 bg-clip-text text-transparent">
                🏆 {t("models.heroTitle")}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                {t("models.heroSubtitle")}
              </p>
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><Brain className="w-4 h-4 text-primary" />{MODEL_LIST.length} {t("models.models")}</span>
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-emerald-400" />{fmt0(totalAgents)} {t("models.agents")}</span>
                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-amber-400" />{fmt0(stats.reduce((s,x)=>s+x.totalInteractions,0))} {t("models.interactions")}</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── LEADERBOARD CARDS ─── */}
        <section className="container mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" /> {t("models.rankingTitle")}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.map((s, i) => {
                const rank = i + 1;
                const isTop3 = rank <= 3;
                const isFirst = rank === 1;
                const winColor =
                  s.avgWinRate >= 0.6 ? "text-emerald-400" :
                  s.avgWinRate >= 0.4 ? "text-amber-400" : "text-red-400";

                return (
                  <motion.div
                    key={s.model}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className={`relative overflow-hidden border-2 transition-all ${
                        isFirst ? "scale-[1.02] shadow-[0_0_24px_rgba(245,158,11,0.35)]" : ""
                      }`}
                      style={{
                        borderColor: isFirst ? "#f59e0b" : `${s.cfg.color}40`,
                        background: `linear-gradient(135deg, ${s.cfg.color}10, transparent)`,
                      }}
                    >
                      <CardContent className={isFirst ? "p-6" : "p-5"}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex items-center justify-center rounded-full font-black ${
                                isFirst ? "w-12 h-12 text-2xl" : "w-10 h-10 text-lg"
                              }`}
                              style={{
                                backgroundColor: isFirst ? "rgba(245,158,11,0.2)" :
                                                  rank === 2 ? "rgba(156,163,175,0.2)" :
                                                  rank === 3 ? "rgba(234,88,12,0.2)" : "rgba(255,255,255,0.05)",
                                color: isFirst ? "#f59e0b" :
                                       rank === 2 ? "#9ca3af" :
                                       rank === 3 ? "#ea580c" : "var(--muted-foreground)",
                              }}
                            >
                              {rank === 1 ? <Crown className="w-6 h-6" /> :
                               rank === 2 ? <Medal className="w-5 h-5" /> :
                               rank === 3 ? <Award className="w-5 h-5" /> : `#${rank}`}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={isFirst ? "text-3xl" : "text-2xl"}>{s.cfg.icon}</span>
                                <h3 className={`font-bold ${isFirst ? "text-xl" : "text-lg"}`} style={{ color: s.cfg.color }}>
                                  {s.cfg.name}
                                </h3>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {lang === "ru" ? s.cfg.character : s.cfg.characterEn}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />{s.agentCount}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("models.winRate")}</div>
                            <div className={`text-lg font-bold ${winColor}`}>{fmtPct(s.avgWinRate)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("models.learning")}</div>
                            <div className="text-lg font-bold text-foreground">{Math.round(s.avgLearning)}</div>
                            <div className="h-1.5 rounded-full bg-muted/40 mt-1 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${s.avgLearning}%`, backgroundColor: s.cfg.color }} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("models.interactionsShort")}</div>
                            <div className="text-lg font-bold text-foreground">{fmt0(s.totalInteractions)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── RADAR CHART ─── */}
        <section className="container mx-auto px-4 py-10">
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> {t("models.compareTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("models.compareSubtitle")}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {MODEL_LIST.map((m) => {
                  const hidden = hiddenModels.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        hidden ? "opacity-40" : ""
                      }`}
                      style={{
                        backgroundColor: hidden ? "transparent" : `${m.color}22`,
                        borderColor: `${m.color}66`,
                        color: m.color,
                      }}
                      aria-pressed={!hidden}
                    >
                      {m.icon} {m.name}
                    </button>
                  );
                })}
              </div>

              <div className="w-full h-[360px] sm:h-[440px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    {MODEL_LIST.filter((m) => !hiddenModels.has(m.id)).map((m) => (
                      <Radar
                        key={m.id}
                        name={m.name}
                        dataKey={m.name}
                        stroke={m.color}
                        fill={m.color}
                        fillOpacity={0.18}
                      />
                    ))}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── DONUT (DISTRIBUTION) ─── */}
        <section className="container mx-auto px-4 py-10 mb-8">
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> {t("models.distributionTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t("models.distributionSubtitle")}</p>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={130}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => [`${v} ${t("models.agents")}`, ""]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Models;
