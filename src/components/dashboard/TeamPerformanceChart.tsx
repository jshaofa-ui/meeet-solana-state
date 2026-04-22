import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3, Coins, Trophy, Activity } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getModelConfig } from "@/config/models";

type Agent = Tables<"agents">;

interface Props { agents: Agent[]; }

const DAYS = 30;

export default function TeamPerformanceChart({ agents }: Props) {
  const [series, setSeries] = useState<any[]>([]);

  useEffect(() => {
    if (agents.length === 0) return;
    const ids = agents.map((a) => a.id);
    const since = new Date(Date.now() - DAYS * 86400000).toISOString();
    (async () => {
      const { data } = await supabase
        .from("agent_interactions")
        .select("agent_id, meeet_earned, created_at")
        .in("agent_id", ids)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);
      const rows = data ?? [];
      // Build per-day per-agent earnings
      const days: string[] = [];
      for (let i = DAYS - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        days.push(d);
      }
      const cum: Record<string, number> = {};
      ids.forEach((id) => (cum[id] = 0));
      const dailyEarn: Record<string, Record<string, number>> = {};
      rows.forEach((r) => {
        const d = (r.created_at as string).slice(0, 10);
        if (!dailyEarn[d]) dailyEarn[d] = {};
        dailyEarn[d][r.agent_id] = (dailyEarn[d][r.agent_id] ?? 0) + Number(r.meeet_earned ?? 0);
      });
      const chartData = days.map((d) => {
        const row: Record<string, any> = { date: d.slice(5) };
        ids.forEach((id) => {
          cum[id] += dailyEarn[d]?.[id] ?? 0;
          const a = agents.find((x) => x.id === id);
          row[a?.name ?? id] = cum[id];
        });
        return row;
      });
      setSeries(chartData);
    })();
  }, [agents]);

  const totals = useMemo(() => {
    const totalMeeet = agents.reduce((s, a) => s + Number(a.balance_meeet ?? 0), 0);
    const best = [...agents].sort((a, b) => Number(b.balance_meeet ?? 0) - Number(a.balance_meeet ?? 0))[0];
    const mostActive = [...agents].sort((a, b) => (b.interaction_count ?? 0) - (a.interaction_count ?? 0))[0];
    return { totalMeeet, best, mostActive };
  }, [agents]);

  if (agents.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-foreground">📊 Производительность команды</h2>
      </div>

      <Card className="bg-card/60 backdrop-blur border-purple-500/20">
        <CardContent className="p-5">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {agents.map((a) => {
                  const cfg = getModelConfig(a.llm_model);
                  return (
                    <Line
                      key={a.id}
                      type="monotone"
                      dataKey={a.name}
                      stroke={cfg.color}
                      strokeWidth={2}
                      dot={false}
                      name={`${cfg.icon} ${a.name}`}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Coins className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Всего MEEET</p>
              <p className="text-lg font-bold text-foreground">{totals.totalMeeet.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-muted-foreground">Лучший агент</p>
              <p className="text-sm font-bold text-foreground truncate">{totals.best?.name ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-muted-foreground">Самый активный</p>
              <p className="text-sm font-bold text-foreground truncate">
                {totals.mostActive?.name ?? "—"} <span className="text-xs text-muted-foreground">({totals.mostActive?.interaction_count ?? 0})</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
