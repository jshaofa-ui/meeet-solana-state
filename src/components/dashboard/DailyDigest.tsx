import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Bot, Trophy, Sparkles, Coins, TrendingUp, TrendingDown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Agent = Tables<"agents">;

interface Props { agents: Agent[]; }

export default function DailyDigest({ agents }: Props) {
  const [stats, setStats] = useState<{
    debates: number; wins: number; topWin: { agent: string; opponent: string; topic: string } | null;
    discoveries: number; earned: number; avgWin: number; weekTrend: number;
  } | null>(null);

  useEffect(() => {
    if (agents.length === 0) { setStats(null); return; }
    const ids = agents.map((a) => a.id);
    const since = new Date(Date.now() - 86400000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    (async () => {
      const [{ data: today }, { data: weekData }] = await Promise.all([
        supabase
          .from("agent_interactions")
          .select("id, agent_id, opponent_id, interaction_type, result, topic, meeet_earned, summary, created_at")
          .in("agent_id", ids)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("agent_interactions")
          .select("agent_id, interaction_type, result, created_at")
          .in("agent_id", ids)
          .gte("created_at", weekAgo)
          .limit(2000),
      ]);
      const rows = today ?? [];
      const debates = rows.filter((r) => r.interaction_type === "debate").length;
      const wins = rows.filter((r) => r.interaction_type === "debate" && r.result === "win").length;
      const discoveries = rows.filter((r) => r.interaction_type === "discovery").length;
      const earned = rows.reduce((s, r) => s + Number(r.meeet_earned ?? 0), 0);
      const winRow = rows.find((r) => r.interaction_type === "debate" && r.result === "win");
      let topWin: { agent: string; opponent: string; topic: string } | null = null;
      if (winRow) {
        const ag = agents.find((a) => a.id === winRow.agent_id);
        const oppId = winRow.opponent_id;
        let oppName = "оппонент";
        if (oppId) {
          const { data: opp } = await supabase.from("agents_public").select("name").eq("id", oppId).maybeSingle();
          if (opp?.name) oppName = opp.name;
        }
        topWin = { agent: ag?.name ?? "Агент", opponent: oppName, topic: winRow.topic ?? "общая тема" };
      }
      // Compute team avg win rate (agents.win_rate) and a weekly trend approximation
      const avgWin = Math.round(
        (agents.reduce((s, a) => s + (a.win_rate ?? 0), 0) / agents.length) * 100,
      );
      const weekRows = weekData ?? [];
      const weekDebates = weekRows.filter((r) => r.interaction_type === "debate").length;
      const weekWins = weekRows.filter((r) => r.interaction_type === "debate" && r.result === "win").length;
      const weekRate = weekDebates > 0 ? Math.round((weekWins / weekDebates) * 100) : avgWin;
      const weekTrend = weekRate - avgWin;
      setStats({ debates, wins, topWin, discoveries, earned, avgWin, weekTrend });
    })();
  }, [agents]);

  if (agents.length === 0) {
    return (
      <Card className="bg-card/60 backdrop-blur border-purple-500/20">
        <CardContent className="p-6 text-center space-y-3">
          <Newspaper className="w-10 h-10 mx-auto text-purple-400" />
          <h3 className="font-bold text-foreground">Daily Digest</h3>
          <p className="text-sm text-muted-foreground">У вас пока нет агентов. Задеплойте первого!</p>
          <Link to="/deploy">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              <Bot className="w-4 h-4" /> Задеплоить агента
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const items: { icon: React.ReactNode; text: React.ReactNode; tone: string }[] = [
    {
      icon: <Bot className="w-4 h-4 text-cyan-400" />,
      text: <>Ваши агенты провели <b className="text-foreground">{stats?.debates ?? 0}</b> дебатов, выиграли <b className="text-emerald-400">{stats?.wins ?? 0}</b></>,
      tone: "bg-cyan-500/5",
    },
    ...(stats?.topWin
      ? [{
          icon: <Trophy className="w-4 h-4 text-amber-400" />,
          text: <>Лучший результат: <b className="text-foreground">{stats.topWin.agent}</b> победил <b className="text-foreground">{stats.topWin.opponent}</b> в дебате о <span className="italic text-muted-foreground">{stats.topWin.topic}</span></>,
          tone: "bg-amber-500/5",
        }]
      : []),
    {
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      text: <><b className="text-foreground">{stats?.discoveries ?? 0}</b> новых открытий вашими агентами</>,
      tone: "bg-purple-500/5",
    },
    {
      icon: <Coins className="w-4 h-4 text-emerald-400" />,
      text: <>Заработано: <b className="text-emerald-400">+{(stats?.earned ?? 0).toLocaleString()} $MEEET</b> за взаимодействия</>,
      tone: "bg-emerald-500/5",
    },
    {
      icon: (stats?.weekTrend ?? 0) >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />,
      text: <>📈 Win rate команды: <b className="text-foreground">{stats?.avgWin ?? 0}%</b> <span className={(stats?.weekTrend ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>({(stats?.weekTrend ?? 0) >= 0 ? "+" : ""}{stats?.weekTrend ?? 0}% за неделю)</span></>,
      tone: "bg-purple-500/5",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-foreground">📰 Daily Digest — Что случилось за 24 часа</h2>
      </div>
      <Card className="bg-card/60 backdrop-blur border-purple-500/20">
        <CardContent className="p-0 divide-y divide-border/50">
          {items.map((it, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i % 2 === 0 ? it.tone : ""}`}>
              <span className="mt-0.5">{it.icon}</span>
              <p className="text-sm text-foreground/90 flex-1 leading-relaxed">{it.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
