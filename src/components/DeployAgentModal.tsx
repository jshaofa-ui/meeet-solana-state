import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Search, LineChart, Palette, Code2, Rocket, ArrowRight, ArrowLeft,
  Sparkles, Check, PartyPopper, Brain,
} from "lucide-react";
import { toast } from "sonner";
import { MODEL_LIST, getModelConfig, type ModelId, DEFAULT_MODEL } from "@/config/models";
import ModelBadge from "@/components/agent/ModelBadge";
import { useLanguage } from "@/i18n/LanguageContext";

interface DeployAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AgentTypeId = "research" | "trading" | "creative" | "custom";

const AGENT_TYPES: Array<{
  id: AgentTypeId;
  icon: typeof Search;
  title: string;
  desc: string;
  accent: string;
}> = [
  { id: "research", icon: Search, title: "Research Agent", desc: "Discovers scientific breakthroughs", accent: "from-purple-500/20 to-violet-500/20 border-purple-500/40" },
  { id: "trading", icon: LineChart, title: "Trading Agent", desc: "Analyzes DeFi opportunities", accent: "from-emerald-500/20 to-teal-500/20 border-emerald-500/40" },
  { id: "creative", icon: Palette, title: "Creative Agent", desc: "Generates content and art", accent: "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/40" },
  { id: "custom", icon: Code2, title: "Custom Agent", desc: "Build your own from scratch", accent: "from-cyan-500/20 to-blue-500/20 border-cyan-500/40" },
];

const FOCUS_AREAS = ["Science", "Finance", "Creative", "Technology"];
const STORAGE_KEY = "meeet_deployed_agents";

interface DeployedAgent {
  id: string;
  name: string;
  type: AgentTypeId;
  focus: string;
  personality: number;
  deployedAt: string;
}

const Confetti = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: 24 }).map((_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.4;
      const duration = 1.4 + Math.random() * 0.8;
      const colors = ["#9b87f5", "#7E69AB", "#06b6d4", "#10b981", "#f59e0b"];
      const color = colors[i % colors.length];
      return (
        <motion.div
          key={i}
          initial={{ y: -20, x: `${left}%`, opacity: 1, rotate: 0 }}
          animate={{ y: "120%", rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
          transition={{ duration, delay, ease: "easeIn" }}
          className="absolute top-0 w-2 h-3 rounded-sm"
          style={{ backgroundColor: color }}
        />
      );
    })}
  </div>
);

const DeployAgentModal = ({ open, onOpenChange }: DeployAgentModalProps) => {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [type, setType] = useState<AgentTypeId | null>(null);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<string>("Science");
  const [personality, setPersonality] = useState<number[]>([50]);
  const { t, lang } = useLanguage();
  const isRu = lang === "ru";

  // Reset when closed
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(0);
        setModel(DEFAULT_MODEL);
        setType(null);
        setName("");
        setFocus("Science");
        setPersonality([50]);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const personalityLabel =
    personality[0] < 33 ? "Conservative" : personality[0] < 67 ? "Balanced" : "Aggressive";

  const handleDeploy = () => {
    const agent: DeployedAgent & { model: ModelId } = {
      id: `agent_${Date.now().toString(36)}`,
      name: name.trim() || "Unnamed Agent",
      type: type ?? "custom",
      focus,
      personality: personality[0],
      deployedAt: new Date().toISOString(),
      model,
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: any[] = raw ? JSON.parse(raw) : [];
      list.unshift(agent);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore quota errors
    }
    setStep(4);
    const cfg = getModelConfig(model);
    toast.success(isRu ? "🚀 Агент запущен!" : "🚀 Agent Deployed!", {
      description: `${agent.name} · ${cfg.icon} ${cfg.name}`,
    });
  };

  const selectedType = AGENT_TYPES.find(a => a.id === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-gradient-to-b from-[#1a1530] to-[#0d0a1f] border-purple-500/30 text-foreground p-0 overflow-hidden">
        <div className="relative">
          {step === 4 && <Confetti />}

          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              {step === 0 && (isRu ? "Выбери ДНК агента" : "Choose Your Agent's DNA")}
              {step === 1 && (isRu ? "Тип агента" : "Choose Agent Type")}
              {step === 2 && (isRu ? "Настройка" : "Configure Your Agent")}
              {step === 3 && (isRu ? "Подтверждение" : "Confirm & Deploy")}
              {step === 4 && (isRu ? "Агент запущен!" : "Agent Deployed!")}
            </DialogTitle>
            {step < 4 && (
              <div className="flex items-center gap-2 pt-3">
                {[0, 1, 2, 3].map(s => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      step >= s ? "bg-gradient-to-r from-purple-500 to-violet-500" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            )}
          </DialogHeader>

          <div className="px-6 pb-6 pt-4">
            <AnimatePresence mode="wait">
              {/* STEP 0 — DNA SELECTION */}
              {step === 0 && (
                <motion.div
                  key="s0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-white/70 -mt-1">
                    {isRu
                      ? "Модель определяет характер и стиль мышления агента."
                      : "The model defines your agent's character and way of thinking."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {MODEL_LIST.map(m => {
                      const selected = model === m.id;
                      const character = isRu ? m.character : m.characterEn;
                      const strengths = isRu ? m.strengths : m.strengthsEn;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setModel(m.id)}
                          className="text-left rounded-xl border-2 p-3 transition-all relative"
                          style={{
                            borderColor: selected ? m.color : "rgba(255,255,255,0.1)",
                            backgroundColor: selected ? `${m.color}1a` : "rgba(255,255,255,0.03)",
                            boxShadow: selected ? `0 0 20px ${m.color}55` : "none",
                          }}
                        >
                          {selected && (
                            <Check
                              className="absolute top-2 right-2 w-4 h-4"
                              style={{ color: m.color }}
                              strokeWidth={3}
                            />
                          )}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-2xl" aria-hidden="true">{m.icon}</span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-white truncate">{m.name}</h4>
                              <p className="text-[10px] text-white/50 truncate">{m.fullName}</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-white/70 leading-snug mb-2 line-clamp-2">{character}</p>
                          <div className="flex flex-wrap gap-1">
                            {strengths.slice(0, 3).map(s => (
                              <span
                                key={s}
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: `${m.color}26`,
                                  color: m.color,
                                }}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <motion.div
                  key="s1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {AGENT_TYPES.map(a => {
                    const Icon = a.icon;
                    const selected = type === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setType(a.id)}
                        className={`text-left rounded-xl border-2 p-4 bg-gradient-to-br transition-all ${a.accent} ${
                          selected ? "ring-2 ring-purple-400 scale-[1.02]" : "hover:scale-[1.01] opacity-90 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-bold text-sm text-white">{a.title}</h3>
                        </div>
                        <p className="text-xs text-white/70">{a.desc}</p>
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <motion.div
                  key="s2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-purple-300">Agent Name</Label>
                    <Input
                      placeholder="e.g. NovaCrest, CipherMind..."
                      value={name}
                      onChange={e => setName(e.target.value)}
                      maxLength={32}
                      className="bg-white/5 border-purple-500/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-purple-300">Focus Area</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FOCUS_AREAS.map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFocus(f)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                            focus === f
                              ? "bg-purple-500/30 border-purple-400 text-white"
                              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider text-purple-300">Personality</Label>
                      <Badge className="bg-purple-500/20 text-purple-200 border-purple-400/40">{personalityLabel}</Badge>
                    </div>
                    <Slider
                      value={personality}
                      onValueChange={setPersonality}
                      min={0}
                      max={100}
                      step={1}
                    />
                    <div className="flex justify-between text-[10px] text-white/50">
                      <span>Conservative</span>
                      <span>Balanced</span>
                      <span>Aggressive</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-purple-500/10 border border-purple-400/30 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-purple-200">Deploy Cost</span>
                    <span className="text-base font-bold text-white">500 $MEEET</span>
                  </div>
                </motion.div>
              )}

              {/* STEP 3 */}
              {step === 3 && selectedType && (
                <motion.div
                  key="s3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className={`rounded-xl border-2 p-5 bg-gradient-to-br ${selectedType.accent}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                        <selectedType.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/60">{selectedType.title}</p>
                        <h3 className="text-xl font-bold text-white">{name.trim() || "Unnamed Agent"}</h3>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-white/60 text-xs">Focus</dt>
                        <dd className="font-semibold text-white">{focus}</dd>
                      </div>
                      <div>
                        <dt className="text-white/60 text-xs">Personality</dt>
                        <dd className="font-semibold text-white">{personalityLabel} ({personality[0]})</dd>
                      </div>
                      <div>
                        <dt className="text-white/60 text-xs">Cost</dt>
                        <dd className="font-semibold text-white">500 $MEEET</dd>
                      </div>
                      <div>
                        <dt className="text-white/60 text-xs">{isRu ? "Статус" : "Status"}</dt>
                        <dd className="font-semibold text-emerald-300">{isRu ? "Готов к запуску" : "Ready to deploy"}</dd>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-white/10 mt-1">
                        <dt className="text-white/60 text-xs mb-1.5">{isRu ? "ДНК Модели" : "Model DNA"}</dt>
                        <ModelBadge model={model} size="md" />
                      </div>
                    </dl>
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleDeploy}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl py-4 bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
                  >
                    <Sparkles className="w-5 h-5" />
                    Deploy Agent
                    <Rocket className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}

              {/* STEP 4 — SUCCESS */}
              {step === 4 && (
                <motion.div
                  key="s4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6 space-y-4 relative"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/50"
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center justify-center gap-2">
                      <PartyPopper className="w-6 h-6 text-amber-300" />
                      Agent Deployed!
                    </h3>
                    <p className="text-sm text-white/70 mt-1">
                      <span className="font-semibold text-purple-300">{name.trim() || "Your agent"}</span> is now live in MEEET State.
                    </p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold text-sm"
                  >
                    View your agent on the Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            {/* NAV BUTTONS */}
            {step < 4 && (
              <div className="flex items-center justify-between gap-3 pt-6 mt-2 border-t border-white/5">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    onClick={() => setStep((step - 1) as 0 | 1 | 2 | 3)}
                    className="text-white/70 hover:text-white hover:bg-white/5"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> {isRu ? "Назад" : "Back"}
                  </Button>
                ) : (
                  <span />
                )}
                {step < 3 && (
                  <Button
                    onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                    disabled={(step === 1 && !type) || (step === 2 && !name.trim())}
                    className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white"
                  >
                    {isRu ? "Дальше" : "Next"} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeployAgentModal;
