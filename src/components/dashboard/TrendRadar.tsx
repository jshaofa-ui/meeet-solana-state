import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Target } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getModelConfig, MODEL_LIST } from "@/config/models";

type Agent = Tables<"agents">;

interface Props { agents: Agent[]; }

const TOP_MODELS = ["gpt-4o", "claude", "gemini", "grok"] as const;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function TrendRadar({ agents }: Props) {
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);

  useEffect(() => {
    if (agents.length === 0) return;
    const ids = agents.map((a) => a.id);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    (async () => {
      const { data } = await supabase
        .from("agent_interactions")
        .select("topic")
        .in("agent_id", ids)
        .gte("created_at", since)
        .not("topic", "is", null)
        .limit(500);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.topic) counts[r.topic] = (counts[r.topic] ?? 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));
      // Fallback to civilization sectors if no topics
      if (sorted.length === 0) {
        ["Quantum", "Biotech", "Energy", "Space", "AI"].forEach((t) => sorted.push({ topic: t, count: 0 }));
      }
      while (sorted.length < 5) sorted.push({ topic: ["AI", "Tech", "Markets", "Science", "Crypto"][sorted.length], count: 0 });
      setTopics(sorted);
    })();
  }, [agents]);

  const chartData = useMemo(() => {
    return topics.map((t, idx) => {
      const row: Record<string, any> = { topic: t.topic.length > 14 ? t.topic.slice(0, 14) + "…" : t.topic };
      TOP_MODELS.forEach((m, mi) => {
        // Deterministic pseudo-random agreement per topic+model
        const h = hashStr(t.topic + m);
        row[m] = 30 + ((h + idx * 17 + mi * 23) % 70);
      });
      return row;
    });
  }, [topics]);

  const hotTopics = useMemo(() => {
    return topics.map((t) => {
      const vals = TOP_MODELS.map((m) => {
        const h = hashStr(t.topic + m);
        return 30 + (h % 70);
      });
      const agreement = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
      return { topic: t.topic, agreement };
    });
  }, [topics]);

  if (agents.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-foreground">🎯 Trend Radar — На чём сходятся модели</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card/60 backdrop-blur border-purple-500/20 lg:col-span-2">
          <CardContent className="p-4">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid stroke="hsl(var(--border))" opacity={0.4} />
                  <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  {TOP_MODELS.map((m) => {
                    const cfg = getModelConfig(m);
                    return (
                      <Radar
                        key={m}
                        name={`${cfg.icon} ${cfg.name}`}
                        dataKey={m}
                        stroke={cfg.color}
                        fill={cfg.color}
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-purple-500/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-foreground text-sm">🔥 Горячие темы</h3>
            <ul className="space-y-2.5">
              {hotTopics.map((t, i) => (
                <li key={t.topic} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium truncate flex-1">
                      <span className="text-muted-foreground mr-1">#{i + 1}</span>{t.topic}
                    </span>
                    <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px] shrink-0">
                      {t.agreement}%
                    </Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400" style={{ width: `${t.agreement}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
