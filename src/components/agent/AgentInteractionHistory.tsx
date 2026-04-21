/**
 * Round 24 — Agent profile section: interaction history + learning progress.
 * Reads `agent_interactions` directly. No hardcoded data.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Coins, Trophy, Activity as ActivityIcon, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { getModelConfig, type ModelId } from "@/config/models";
import {
  INTERACTION_META, timeAgo, type AgentInteractionRow, type InteractionType,
} from "@/lib/interactions";

interface Props {
  agentId: string;
  modelId: ModelId | string | null | undefined;
}

const fmt0 = (n: number) => Math.round(n).toLocaleString();

export default function AgentInteractionHistory({ agentId, modelId }: Props) {
  const { t, lang } = useLanguage();
  const isRu = lang === "ru";
  const [openId, setOpenId] = useState<string | null>(null);
  const cfg = getModelConfig(modelId as any);

  const { data: rows = [] } = useQuery<AgentInteractionRow[]>({
    queryKey: ["agent-interactions", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_interactions" as any)
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as AgentInteractionRow[];
    },
    enabled: Boolean(agentId),
    staleTime: 30_000,
  });

  // Stats
  const stats = useMemo(() => {
    const debates = rows.filter((r) => r.interaction_type === "debate");
    const wins = debates.filter((r) => r.result === "win").length;
    const total = rows.length;
    const earned = rows.reduce((s, r) => s + Number(r.meeet_earned ?? 0), 0);
    const winRate = debates.length ? (wins / debates.length) * 100 : 0;
    return { total, winRate, earned };
  }, [rows]);

  // 30d win-rate area
  const chartData = useMemo(() => {
    const days: { day: string; wr: number }[] = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const start = now - (i + 1) * 86400_000;
      const end = now - i * 86400_000;
      const slice = rows.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return r.interaction_type === "debate" && t >= start && t < end;
      });
      const wins = slice.filter((r) => r.result === "win").length;
      const wr = slice.length ? (wins / slice.length) * 100 : 0;
      const d = new Date(end);
      days.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, wr: Math.round(wr) });
    }
    return days;
  }, [rows]);

  const patterns = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.learned_pattern) {
        map.set(r.learned_pattern, (map.get(r.learned_pattern) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [rows]);

  const top20 = rows.slice(0, 20);

  return (
    <div className="space-y-6">
      {/* History */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-primary" />
            {t("interactions.historyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatTile icon={<ActivityIcon className="w-4 h-4" />} label={t("interactions.total") as string} value={fmt0(stats.total)} />
            <StatTile icon={<Trophy className="w-4 h-4 text-emerald-400" />} label={t("interactions.winRate") as string} value={`${Math.round(stats.winRate)}%`} accent="text-emerald-400" />
            <StatTile icon={<Coins className="w-4 h-4 text-amber-400" />} label={t("interactions.earned") as string} value={fmt0(stats.earned)} accent="text-amber-400" />
          </div>

          {top20.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("interactions.empty")}</p>
          ) : (
            <div className="relative pl-5">
              {/* timeline vertical line */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-border/0 via-border to-border/0" />
              <div className="space-y-3">
                {top20.map((r) => {
                  const meta = INTERACTION_META[r.interaction_type as InteractionType] ?? INTERACTION_META.governance;
                  const open = openId === r.id;
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative"
                    >
                      <span
                        className={`absolute -left-3 top-3 w-3 h-3 rounded-full ring-2 ring-background ${meta.bg}`}
                        style={{ boxShadow: `0 0 0 1px hsl(var(--border))` }}
                      />
                      <button
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="w-full text-left rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-colors p-3"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{meta.icon}</span>
                          <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta.color}`}>
                            {labelForType(r.interaction_type as InteractionType, t)}
                          </span>
                          {r.result && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">{r.result}</Badge>
                          )}
                          {r.meeet_earned ? (
                            <span className="ml-auto text-[11px] font-mono text-amber-300">+{r.meeet_earned} MEEET</span>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground ml-auto md:ml-2">
                            {timeAgo(r.created_at, isRu)}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                        </div>
                        {r.topic && <p className="text-sm text-foreground mt-1 line-clamp-2">{r.topic}</p>}

                        <AnimatePresence>
                          {open && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 space-y-2 text-xs">
                                {r.agent_argument && (
                                  <p><span className="font-semibold text-foreground">{t("live.argument")}: </span><span className="text-muted-foreground">{r.agent_argument}</span></p>
                                )}
                                {r.opponent_argument && (
                                  <p><span className="font-semibold text-foreground">{t("live.counter")}: </span><span className="text-muted-foreground">{r.opponent_argument}</span></p>
                                )}
                                {r.learned_pattern && (
                                  <p className="flex items-start gap-1.5"><span>🧠</span><span className="text-muted-foreground">{r.learned_pattern}</span></p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learning */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" style={{ color: cfg.color }} />
            {t("interactions.learningTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">{t("interactions.chart30d")}</p>
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id={`grad-${agentId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cfg.color} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={cfg.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={4} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v}%`, t("interactions.winRate") as string]}
                />
                <Area type="monotone" dataKey="wr" stroke={cfg.color} strokeWidth={2} fill={`url(#grad-${agentId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {patterns.length > 0 && (
            <>
              <h4 className="text-sm font-semibold mt-5 mb-2 text-foreground">{t("interactions.patterns")}</h4>
              <ul className="space-y-1.5">
                {patterns.map(([p, n]) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <span>🧠</span>
                    <span className="text-muted-foreground flex-1">{p}</span>
                    <Badge variant="outline" className="text-[10px]">×{n}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function labelForType(type: InteractionType, t: (k: string) => any): string {
  switch (type) {
    case "debate": return t("live.typeDebate");
    case "discovery_review": return t("live.typeDiscovery");
    case "prediction": return t("live.typePrediction");
    case "governance": return t("live.typeGovernance");
    default: return type;
  }
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-0.5 text-muted-foreground">{icon}</div>
      <div className={`text-lg font-bold font-mono ${accent ?? "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}
