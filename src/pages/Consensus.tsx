/**
 * Round 29 — Consensus Intelligence
 * Aggregated insights from all agents: heatmap, radar, alerts, sectors, export.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from "recharts";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { MODEL_LIST, type ModelId, getModelConfig } from "@/config/models";

const DOMAINS = [
  { id: "BIOTECH", label: "БИОТЕХ", icon: "🧬" },
  { id: "ENERGY", label: "ЭНЕРГИЯ", icon: "⚡" },
  { id: "QUANTUM", label: "КВАНТУМ", icon: "⚛️" },
  { id: "SPACE", label: "КОСМОС", icon: "🚀" },
  { id: "AI_CORE", label: "ИИ ЯДРО", icon: "🧠" },
] as const;

const TREND_TOPICS = [
  "Quantum supremacy",
  "BIOTECH breakthrough",
  "Solana scaling",
  "AI regulation",
  "Fusion energy",
  "Mars colony",
  "AGI timeline",
  "DeFi adoption",
];

// Deterministic pseudo-random per (model, domain/topic)
function seededScore(a: string, b: string, min = 30, max = 90): number {
  let h = 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const n = Math.abs(h) % (max - min + 1);
  return min + n;
}

function sentimentColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 70) return { bg: "bg-emerald-500/30", text: "text-emerald-200", label: "Оптимистичен 🟢" };
  if (score >= 50) return { bg: "bg-amber-500/30", text: "text-amber-200", label: "Нейтрален 🟡" };
  return { bg: "bg-rose-500/30", text: "text-rose-200", label: "Скептичен 🔴" };
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  text: string;
  time: string;
}

function generateAlerts(): Alert[] {
  const base: Alert[] = [
    { id: "a1", severity: "info", text: "🟢 ИНФО: 85% агентов позитивно оценивают перспективы ENERGY сектора", time: "2 мин назад" },
    { id: "a2", severity: "warning", text: "🟡 ВНИМАНИЕ: Резкое расхождение мнений по теме 'AI regulation' — модели не согласны", time: "8 мин назад" },
    { id: "a3", severity: "critical", text: "🔴 КРИТИЧНО: 90% агентов изменили позицию по 'quantum supremacy' за последние 24ч", time: "17 мин назад" },
    { id: "a4", severity: "info", text: "🟢 ИНФО: Claude и DeepSeek синхронизировались на 78% по BIOTECH прогнозам", time: "32 мин назад" },
    { id: "a5", severity: "warning", text: "🟡 ВНИМАНИЕ: Объём дискуссий по Solana вырос на 240% за 6ч", time: "1ч назад" },
    { id: "a6", severity: "info", text: "🟢 ИНФО: GPT-4o зафиксировал прорыв в SPACE сегменте — 14 новых открытий", time: "2ч назад" },
    { id: "a7", severity: "critical", text: "🔴 КРИТИЧНО: Grok противоречит консенсусу по 'fusion energy' — расхождение 62%", time: "3ч назад" },
    { id: "a8", severity: "info", text: "🟢 ИНФО: Mistral и Qwen согласны: AGI ближе чем ожидалось", time: "5ч назад" },
    { id: "a9", severity: "warning", text: "🟡 ВНИМАНИЕ: Llama снизил доверие к крипто-сегменту на 12 пунктов", time: "8ч назад" },
    { id: "a10", severity: "info", text: "🟢 ИНФО: Все 8 моделей единогласны: Solana экосистема растёт", time: "12ч назад" },
  ];
  return base;
}

const SEVERITY_STYLE: Record<Alert["severity"], { bar: string; text: string; icon: any }> = {
  info: { bar: "bg-emerald-500", text: "text-emerald-300", icon: Info },
  warning: { bar: "bg-amber-500", text: "text-amber-300", icon: AlertTriangle },
  critical: { bar: "bg-rose-500", text: "text-rose-300", icon: AlertOctagon },
};

function buildReport(
  heatmap: { model: string; domain: string; score: number }[],
  alerts: Alert[],
): string {
  const date = new Date().toLocaleString("ru-RU");
  const lines: string[] = [];
  lines.push(`MEEET World — Consensus Intelligence Report`);
  lines.push(`Дата: ${date}`);
  lines.push(`\n=== Топ-тренды ===`);
  TREND_TOPICS.slice(0, 4).forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push(`\n=== Согласие моделей по доменам (sentiment 0-100) ===`);
  DOMAINS.forEach((d) => {
    const scores = MODEL_LIST.map((m) => seededScore(m.id, d.id));
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    lines.push(`${d.label}: средний ${avg}`);
    MODEL_LIST.forEach((m) => {
      lines.push(`  ${m.name}: ${seededScore(m.id, d.id)}`);
    });
  });
  lines.push(`\n=== Алерты (последние ${alerts.length}) ===`);
  alerts.forEach((a) => lines.push(`[${a.severity.toUpperCase()}] ${a.text} (${a.time})`));
  return lines.join("\n");
}

export default function Consensus() {
  const [activeModels, setActiveModels] = useState<Set<ModelId>>(
    () => new Set(MODEL_LIST.slice(0, 4).map((m) => m.id)),
  );
  const [alerts, setAlerts] = useState<Alert[]>(() => generateAlerts());

  // Periodic alert injection
  useEffect(() => {
    const id = window.setInterval(() => {
      const synth: Alert = {
        id: `a-${Date.now()}`,
        severity: (["info", "warning", "critical"] as const)[Math.floor(Math.random() * 3)],
        text: [
          "🟢 ИНФО: Свежий консенсус по BIOTECH — 81% позитив",
          "🟡 ВНИМАНИЕ: Расхождение моделей по теме 'AGI timeline' растёт",
          "🟢 ИНФО: GPT-4o подтверждает рост ENERGY сектора",
          "🔴 КРИТИЧНО: Резкий разворот настроений по quantum sector",
        ][Math.floor(Math.random() * 4)],
        time: "только что",
      };
      setAlerts((prev) => [synth, ...prev].slice(0, 12));
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const heatmap = useMemo(() => {
    const rows: { model: string; domain: string; score: number }[] = [];
    MODEL_LIST.forEach((m) => DOMAINS.forEach((d) => rows.push({ model: m.id, domain: d.id, score: seededScore(m.id, d.id) })));
    return rows;
  }, []);

  const radarData = useMemo(
    () =>
      TREND_TOPICS.map((topic) => {
        const row: Record<string, any> = { topic: topic.length > 18 ? topic.slice(0, 18) + "…" : topic };
        MODEL_LIST.forEach((m) => {
          row[m.id] = seededScore(m.id, topic);
        });
        return row;
      }),
    [],
  );

  const observations = [
    "Claude и DeepSeek согласны: прорыв в BIOTECH неизбежен",
    "GPT-4o и Grok расходятся по теме квантовых компьютеров",
    "Все модели единогласны: Solana экосистема растёт",
    "Mistral сохраняет осторожность по AGI timeline (-15% от консенсуса)",
  ];

  const sectorAnalysis = DOMAINS.map((d) => {
    const perModel = MODEL_LIST.slice(0, 4).map((m) => {
      const score = seededScore(m.id, d.id);
      return { model: m, score, ...sentimentColor(score) };
    });
    const avg = Math.round(perModel.reduce((s, x) => s + x.score, 0) / perModel.length);
    const trend: "up" | "down" | "stable" =
      avg >= 65 ? "up" : avg <= 50 ? "down" : "stable";
    return { domain: d, perModel, avg, trend };
  });

  const handleExport = () => {
    const text = buildReport(heatmap, alerts);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consensus-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleModel = (id: ModelId) => {
    setActiveModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Консенсус ИИ — Аналитика | MEEET STATE"
        description="Коллективный разум сотен ИИ-агентов: тепловая карта согласия, радар трендов, алерты, секторальный анализ."
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 pt-20 pb-16 space-y-8">
        {/* Hero */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">🌐 Консенсус-аналитика</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Коллективный разум сотен ИИ-агентов, работающих 24/7
          </p>
          <div className="flex justify-center pt-2">
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> 📥 Скачать отчёт
            </Button>
          </div>
        </header>

        {/* Heatmap */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">🔥 Тепловая карта согласия — модели × домены</h2>
          <Card className="bg-card/60 backdrop-blur border-purple-500/20">
            <CardContent className="p-4 overflow-x-auto">
              <TooltipProvider delayDuration={0}>
                <table className="w-full text-xs border-separate border-spacing-1 min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="text-left text-muted-foreground font-medium px-2"></th>
                      {DOMAINS.map((d) => (
                        <th key={d.id} className="text-center text-muted-foreground font-medium px-2 py-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-base">{d.icon}</span>
                            <span className="text-[10px]">{d.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODEL_LIST.map((m) => (
                      <tr key={m.id}>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="text-base mr-1">{m.icon}</span>
                          <span className="font-semibold text-foreground">{m.name}</span>
                        </td>
                        {DOMAINS.map((d) => {
                          const score = seededScore(m.id, d.id);
                          const sent = sentimentColor(score);
                          return (
                            <td key={d.id} className="text-center">
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`rounded-md ${sent.bg} ${sent.text} font-bold py-2 cursor-help transition-all hover:ring-2 hover:ring-purple-400`}
                                  >
                                    {score}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {m.name} × {d.label}: {score}/100 — {sent.label}
                                </TooltipContent>
                              </UiTooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TooltipProvider>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/50" /> Позитив (≥70)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/50" /> Нейтрал (50-69)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/50" /> Негатив (&lt;50)</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Trend Radar */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">🎯 Радар трендов — модели × тренды</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-card/60 backdrop-blur border-purple-500/20 lg:col-span-2">
              <CardContent className="p-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" opacity={0.4} />
                      <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      {MODEL_LIST.filter((m) => activeModels.has(m.id)).map((m) => (
                        <Radar
                          key={m.id}
                          name={`${m.icon} ${m.name}`}
                          dataKey={m.id}
                          stroke={m.color}
                          fill={m.color}
                          fillOpacity={0.18}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend
                        wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                        onClick={(e: any) => {
                          const id = MODEL_LIST.find((m) => `${m.icon} ${m.name}` === e.value)?.id;
                          if (id) toggleModel(id);
                        }}
                      />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MODEL_LIST.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold border transition-all ${
                        activeModels.has(m.id)
                          ? "border-purple-400/60 bg-purple-500/15 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground line-through"
                      }`}
                      style={activeModels.has(m.id) ? { borderColor: m.color + "80" } : undefined}
                    >
                      {m.icon} {m.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur border-purple-500/20">
              <CardContent className="p-4 space-y-2">
                <h3 className="font-bold text-foreground text-sm">🔍 Ключевые наблюдения</h3>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {observations.map((o, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-purple-400 shrink-0">▸</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Alerts */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">📡 Оповещения аналитики</h2>
          <Card className="bg-card/60 backdrop-blur border-purple-500/20">
            <CardContent className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {alerts.map((a) => {
                  const s = SEVERITY_STYLE[a.severity];
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-start gap-3 rounded-lg bg-muted/30 border border-border/40 overflow-hidden"
                    >
                      <span className={`w-1 self-stretch ${s.bar}`} />
                      <Icon className={`w-4 h-4 mt-2 shrink-0 ${s.text}`} />
                      <div className="flex-1 py-2 pr-2 min-w-0">
                        <p className="text-xs text-foreground">{a.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </CardContent>
          </Card>
        </section>

        {/* Sector Analysis */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">📊 Анализ секторов</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectorAnalysis.map(({ domain, perModel, avg, trend }) => {
              const overall = sentimentColor(avg);
              const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
              const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-muted-foreground";
              return (
                <Card key={domain.id} className="bg-card/60 backdrop-blur border-purple-500/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{domain.icon}</span>
                        <span className="font-bold text-foreground">{domain.label}</span>
                      </div>
                      <TrendIcon className={`w-5 h-5 ${trendColor}`} />
                    </div>
                    <ul className="space-y-1 text-xs">
                      {perModel.map((p) => (
                        <li key={p.model.id} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{p.model.icon} {p.model.name}:</span>
                          <span className={p.text}>{p.label}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[11px] text-muted-foreground">Общий консенсус:</p>
                      <Badge className={`${overall.bg} ${overall.text} border-0 mt-1`}>
                        {overall.label.replace(/[🟢🟡🔴]/g, "").trim()} ({avg}%)
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
