import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Zap, TrendingUp, Trophy, History } from "lucide-react";
import { LLM_MODELS, MODEL_LIST, ModelId, getModelConfig } from "@/config/models";
import { toast } from "sonner";

interface Market {
  id: string;
  question: string;
  perModel: { model: ModelId; yesPct: number; agents: number }[];
  spread: number; // max - min
  highest: { model: ModelId; pct: number };
  lowest: { model: ModelId; pct: number };
}

const MOCK_QUESTIONS = [
  "Биткоин превысит $150K в 2026?",
  "GPT-5 выйдет до конца года?",
  "Solana обгонит Ethereum по TVL?",
  "AGI будет достигнут к 2030?",
  "MEEET попадёт в топ-100 CMC?",
  "ИИ-агенты заменят 50% разработчиков?",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function readArr(key: string): any[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function pushArr(key: string, item: any) {
  const arr = readArr(key);
  arr.unshift({ ...item, ts: Date.now() });
  try { localStorage.setItem(key, JSON.stringify(arr.slice(0, 20))); } catch { /* ignore */ }
}

// Per-model bias (analytical/contrarian/etc.)
const MODEL_BIAS: Record<ModelId, number> = {
  "gpt-4o": 8, claude: -3, gemini: 5, llama: 2, mistral: 0, qwen: 4, deepseek: 6, grok: -15,
};

// Stable per-model accuracy %
const MODEL_ACCURACY: Record<ModelId, number> = {
  "gpt-4o": 78, claude: 81, gemini: 73, deepseek: 76, qwen: 68, llama: 64, mistral: 62, grok: 58,
};

export default function OracleCrossModel() {
  const [bets, setBets] = useState<any[]>([]);

  useEffect(() => { setBets(readArr("meeet_oracle_side_bets")); }, []);

  const markets: Market[] = useMemo(() => {
    return MOCK_QUESTIONS.map((q) => {
      const seed = hash(q);
      const base = 35 + (seed % 35); // 35-70 baseline
      const perModel = MODEL_LIST.map((m, i) => {
        const noise = ((seed + i * 41) % 25) - 12;
        const pct = Math.max(5, Math.min(95, base + MODEL_BIAS[m.id] + noise));
        const agents = 40 + ((seed + i * 17) % 60);
        return { model: m.id, yesPct: pct, agents };
      });
      const sorted = [...perModel].sort((a, b) => b.yesPct - a.yesPct);
      const highest = { model: sorted[0].model, pct: sorted[0].yesPct };
      const lowest = { model: sorted[sorted.length - 1].model, pct: sorted[sorted.length - 1].yesPct };
      return { id: q, question: q, perModel, spread: highest.pct - lowest.pct, highest, lowest };
    });
  }, []);

  const divergent = useMemo(() => markets.filter((m) => m.spread > 30).slice(0, 3), [markets]);

  const placeBet = (market: Market, side: "majority" | "minority", model: ModelId) => {
    pushArr("meeet_oracle_side_bets", { question: market.question, side, model });
    setBets(readArr("meeet_oracle_side_bets"));
    toast.success("Ваша ставка принята!");
  };

  const accuracyData = useMemo(
    () =>
      MODEL_LIST
        .map((m) => ({ name: m.name, model: m.id, accuracy: MODEL_ACCURACY[m.id], color: m.color, icon: m.icon }))
        .sort((a, b) => b.accuracy - a.accuracy),
    [],
  );

  return (
    <section className="px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* DIVERGENCE ALERTS */}
        {divergent.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400" /> Дивергенция моделей
            </h2>
            {divergent.map((m) => {
              const highCfg = getModelConfig(m.highest.model);
              const lowCfg = getModelConfig(m.lowest.model);
              const believers = m.perModel.filter((p) => p.yesPct >= 60).sort((a, b) => b.yesPct - a.yesPct).slice(0, 2);
              const doubters = m.perModel.filter((p) => p.yesPct <= 40).sort((a, b) => a.yesPct - b.yesPct).slice(0, 2);
              return (
                <Card key={m.id} className="bg-gradient-to-br from-amber-500/10 to-red-500/5 border-amber-500/30 backdrop-blur">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-xl">⚡</motion.span>
                      <h3 className="font-bold text-amber-300">Модели расходятся!</h3>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">spread {m.spread}%</Badge>
                    </div>
                    <p className="text-base font-medium text-foreground">"{m.question}"</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg p-3 bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-[10px] uppercase text-emerald-400 mb-1">Верят</p>
                        <p className="text-sm text-foreground">
                          {believers.map((b) => `${getModelConfig(b.model).name} (${b.yesPct}%)`).join(", ") || `${highCfg.name} (${m.highest.pct}%)`}
                        </p>
                      </div>
                      <div className="rounded-lg p-3 bg-red-500/5 border border-red-500/20">
                        <p className="text-[10px] uppercase text-red-400 mb-1">Сомневаются</p>
                        <p className="text-sm text-foreground">
                          {doubters.map((d) => `${getModelConfig(d.model).name} (${d.yesPct}%)`).join(", ") || `${lowCfg.name} (${m.lowest.pct}%)`}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">Это инвестиционная возможность!</p>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-foreground">На чью сторону встать?</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => placeBet(m, "majority", m.highest.model)} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 gap-1.5">
                          С большинством ({highCfg.icon} {highCfg.name})
                        </Button>
                        <Button size="sm" onClick={() => placeBet(m, "minority", m.lowest.model)} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 gap-1.5">
                          С меньшинством ({lowCfg.icon} {lowCfg.name})
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* TABS: per-model breakdown */}
        <Tabs defaultValue="models" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xl mx-auto bg-card/60">
            <TabsTrigger value="models">📊 По моделям</TabsTrigger>
            <TabsTrigger value="accuracy">🎯 Точность</TabsTrigger>
            <TabsTrigger value="bets">💼 Мои ставки</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="mt-6 space-y-4">
            {markets.map((m) => (
              <Card key={m.id} className="bg-card/60 backdrop-blur border-border/50">
                <CardContent className="p-5 space-y-3">
                  <p className="font-medium text-foreground">"{m.question}"</p>
                  {/* Stacked horizontal bar — width per model */}
                  <div className="flex h-7 w-full rounded-md overflow-hidden border border-border/40">
                    {m.perModel.map((p) => {
                      const cfg = getModelConfig(p.model);
                      const flex = p.yesPct;
                      return (
                        <div
                          key={p.model}
                          title={`${cfg.fullName}: ${p.yesPct}% Да, ${100 - p.yesPct}% Нет (${p.agents} агентов)`}
                          className="flex items-center justify-center text-[9px] font-bold text-white/95 transition-all hover:brightness-125"
                          style={{ flex, backgroundColor: cfg.color }}
                        >
                          {flex > 8 ? cfg.icon : ""}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                    {m.perModel.map((p) => {
                      const cfg = getModelConfig(p.model);
                      return (
                        <span key={p.model} className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                          <span className="text-foreground">{cfg.name}</span>
                          <span className="text-muted-foreground">{p.yesPct}%</span>
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="accuracy" className="mt-6">
            <Card className="bg-card/60 backdrop-blur border-border/50">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-foreground">Точность предсказаний по моделям</h3>
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accuracyData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} width={80} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any) => [`${v}%`, "Точность"]}
                      />
                      <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                        {accuracyData.map((d) => (
                          <rect key={d.model} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">🏆 Лучший предсказатель</Badge>
                  <span className="text-foreground font-semibold">{accuracyData[0].icon} {accuracyData[0].name}</span>
                  <span className="text-muted-foreground">— {accuracyData[0].accuracy}%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bets" className="mt-6">
            <Card className="bg-card/60 backdrop-blur border-border/50">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold text-foreground">Ваши ставки</h3>
                </div>
                {bets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">У вас пока нет ставок. Сделайте первую через дивергенцию!</p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {bets.map((b, i) => {
                      const cfg = getModelConfig(b.model);
                      return (
                        <li key={i} className="py-3 flex items-center gap-3 text-sm">
                          <span className="text-lg">{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground truncate">{b.question}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {b.side === "majority" ? "С большинством" : "С меньшинством"} · {cfg.name}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(b.ts).toLocaleDateString()}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
