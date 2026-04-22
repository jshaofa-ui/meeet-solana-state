import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Target, Sword, Eye, Landmark, Flame, Scale, Leaf, Check } from "lucide-react";
import ModelBadge from "@/components/agent/ModelBadge";
import { getModelConfig } from "@/config/models";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Agent = Tables<"agents">;

type Strategy = "aggressive" | "balanced" | "cautious";
type MissionType = "research" | "debate" | "prediction" | "politics";

const STRATEGIES: Record<Strategy, { label: string; desc: string; icon: typeof Flame; color: string; ring: string }> = {
  aggressive: { label: "Агрессивный", desc: "Больше дебатов, выше риск", icon: Flame, color: "text-red-400", ring: "ring-red-500/40 bg-red-500/10" },
  balanced: { label: "Сбалансированный", desc: "Равномерная активность", icon: Scale, color: "text-amber-400", ring: "ring-amber-500/40 bg-amber-500/10" },
  cautious: { label: "Осторожный", desc: "Фокус на открытиях, минимум риска", icon: Leaf, color: "text-emerald-400", ring: "ring-emerald-500/40 bg-emerald-500/10" },
};

const MISSIONS: { id: MissionType; icon: string; title: string; desc: string }[] = [
  { id: "research", icon: "🔬", title: "Исследование", desc: "Делать открытия в выбранном домене каждые 2 часа" },
  { id: "debate", icon: "⚔️", title: "Дебаты", desc: "Участвовать в дебатах, приоритет — победы" },
  { id: "prediction", icon: "🔮", title: "Предсказания", desc: "Анализировать Oracle и делать предсказания" },
  { id: "politics", icon: "🏛️", title: "Политика", desc: "Голосовать в Parliament, строить коалиции" },
];

function readMap<T extends string>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, T>; } catch { return {}; }
}
function writeMap(key: string, m: Record<string, string>) {
  try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ }
}

function CircularProgress({ value, color }: { value: number; color: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" opacity="0.3" />
      <motion.circle
        cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }} transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" className="text-[11px] font-bold fill-foreground">{value}%</text>
    </svg>
  );
}

interface Props { agents: Agent[]; }

export default function AgentManagerSection({ agents }: Props) {
  const [strategies, setStrategies] = useState<Record<string, Strategy>>({});
  const [missions, setMissions] = useState<Record<string, MissionType>>({});
  const [missionFor, setMissionFor] = useState<Agent | null>(null);
  const [pickedMission, setPickedMission] = useState<MissionType | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setStrategies(readMap<Strategy>("meeet_agent_strategies"));
    setMissions(readMap<MissionType>("meeet_agent_missions"));
  }, []);

  const setStrategy = (id: string, s: Strategy) => {
    const next = { ...strategies, [id]: s };
    setStrategies(next);
    writeMap("meeet_agent_strategies", next);
    toast.success(`Стратегия: ${STRATEGIES[s].label}`);
  };

  const assignMission = () => {
    if (!missionFor || !pickedMission) return;
    const next = { ...missions, [missionFor.id]: pickedMission };
    setMissions(next);
    writeMap("meeet_agent_missions", next);
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      setMissionFor(null);
      setPickedMission(null);
      toast.success("Миссия назначена!");
    }, 900);
  };

  if (agents.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-foreground">Менеджер агентов</h2>
        <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30">{agents.length}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((a) => {
          const winRate = Math.round(((a.win_rate ?? 0)) * 100) || 0;
          const winColor = winRate >= 60 ? "hsl(142 76% 50%)" : winRate < 40 ? "hsl(0 76% 60%)" : "hsl(45 93% 58%)";
          const isActive = a.status === "active" || a.status === "exploring" || a.status === "idle";
          const cfg = getModelConfig(a.llm_model);
          const strat = strategies[a.id] ?? "balanced";
          const stratCfg = STRATEGIES[strat];
          const StratIcon = stratCfg.icon;
          const mission = missions[a.id];
          const missionCfg = mission ? MISSIONS.find((m) => m.id === mission) : null;

          return (
            <Card key={a.id} className="bg-card/60 backdrop-blur border-purple-500/20 hover:border-purple-500/40 transition-all">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: `${cfg.color}22`, border: `1px solid ${cfg.color}55` }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground truncate">{a.name}</h3>
                      {isActive ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">🟢 Активен</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">🔴 Неактивен</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <ModelBadge model={a.llm_model} size="md" />
                      {a.sector && (
                        <Badge variant="outline" className="text-[10px] capitalize border-border/50">{a.sector}</Badge>
                      )}
                    </div>
                  </div>
                  <CircularProgress value={winRate} color={winColor} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/30 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
                    <p className="text-sm font-bold text-foreground">{winRate}%</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Learning</p>
                    <p className="text-sm font-bold text-foreground">{Math.round((a.learning_score ?? 0) * 100) || 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interact.</p>
                    <p className="text-sm font-bold text-foreground">{a.interaction_count ?? 0}</p>
                  </div>
                </div>

                {missionCfg && (
                  <div className="text-xs px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300">Миссия:</span>
                    <span className="text-foreground font-medium">{missionCfg.icon} {missionCfg.title}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { setMissionFor(a); setPickedMission(null); }} className="gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Назначить миссию
                  </Button>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ring-1 ${stratCfg.ring}`}>
                    <StratIcon className={`w-3.5 h-3.5 ${stratCfg.color}`} />
                    <select
                      value={strat}
                      onChange={(e) => setStrategy(a.id, e.target.value as Strategy)}
                      className={`bg-transparent text-xs font-semibold outline-none cursor-pointer ${stratCfg.color}`}
                      title={stratCfg.desc}
                    >
                      {Object.entries(STRATEGIES).map(([key, s]) => (
                        <option key={key} value={key} className="bg-background text-foreground">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">{stratCfg.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!missionFor} onOpenChange={(o) => { if (!o) { setMissionFor(null); setPickedMission(null); } }}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Назначить миссию агенту {missionFor?.name}
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {confirming ? (
              <motion.div
                key="confirm"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-xl font-bold text-emerald-400">Миссия назначена!</p>
              </motion.div>
            ) : (
              <motion.div key="picker" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MISSIONS.map((m) => {
                    const picked = pickedMission === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPickedMission(m.id)}
                        className={`text-left rounded-xl border p-4 transition-all ${picked ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/40" : "border-border bg-card/40 hover:border-purple-500/50"}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-2xl">{m.icon}</span>
                          <h4 className="font-bold text-foreground">{m.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setMissionFor(null)}>Отмена</Button>
                  <Button
                    disabled={!pickedMission}
                    onClick={assignMission}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Назначить
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </section>
  );
}
