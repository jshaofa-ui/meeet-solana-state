import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Zap, Brain, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  getEnergy,
  spendEnergy,
  hoursUntilReset,
  MAX_ENERGY,
  MAX_HINT,
  addIntervention,
  type InterventionRecord,
} from "@/lib/intervention";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agentName: string;
  agentModel?: string | null;
  context: string; // short summary of activity
  onSuccess?: (rec: InterventionRecord) => void;
}

type Phase = "form" | "loading" | "result";

export default function InterventionModal({
  open, onOpenChange, agentName, agentModel, context, onSuccess,
}: Props) {
  const [hint, setHint] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [energyState, setEnergyState] = useState(() => getEnergy());
  const [result, setResult] = useState<InterventionRecord | null>(null);

  useEffect(() => {
    if (open) {
      setEnergyState(getEnergy());
      setPhase("form");
      setHint("");
      setResult(null);
    }
  }, [open]);

  const energyPct = (energyState.energy / MAX_ENERGY) * 100;
  const noEnergy = energyState.energy <= 0;
  const hoursLeft = hoursUntilReset(energyState);

  const handleSubmit = () => {
    if (!hint.trim() || noEnergy) return;
    const next = spendEnergy();
    if (!next) {
      toast.error("Энергия закончилась");
      return;
    }
    setEnergyState(next);
    setPhase("loading");
    setTimeout(() => {
      const impact = 60 + Math.floor(Math.random() * 36);
      const rec = addIntervention({
        agentName,
        agentModel: agentModel ?? null,
        context: context.slice(0, 200),
        hint: hint.trim(),
        impact,
      });
      setResult(rec);
      setPhase("result");
      onSuccess?.(rec);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <span className="text-xl">🎯</span>
            Вмешательство в активность {agentName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ваше слово влияет на решения собственного агента.
          </DialogDescription>
        </DialogHeader>

        {/* Energy bar always visible */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-semibold text-amber-300">
              <Zap className="w-3.5 h-3.5" /> Энергия: {energyState.energy}/{MAX_ENERGY}
            </span>
            {noEnergy && (
              <span className="text-[10px] text-muted-foreground">
                Восстановится через {hoursLeft}ч
              </span>
            )}
          </div>
          <Progress value={energyPct} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          {phase === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3"
            >
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Текущая активность
                </p>
                <p className="text-xs text-foreground line-clamp-3">{context}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Дай подсказку своему агенту:
                </label>
                <Textarea
                  value={hint}
                  onChange={(e) => setHint(e.target.value.slice(0, MAX_HINT))}
                  placeholder="Используй аргумент про энергоэффективность..."
                  rows={3}
                  disabled={noEnergy}
                  className="resize-none bg-background/60 border-border/60 text-sm"
                />
                <div className="flex justify-end text-[10px] text-muted-foreground">
                  {hint.length}/{MAX_HINT}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!hint.trim() || noEnergy}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
              >
                <Zap className="w-4 h-4 mr-1.5" />
                {noEnergy ? `Энергия восстановится через ${hoursLeft}ч` : "⚡ Отправить (-1 энергия)"}
              </Button>
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 flex flex-col items-center gap-3 text-center"
            >
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm text-foreground font-medium">Обрабатываю вмешательство...</p>
              <p className="text-xs text-muted-foreground">Агент анализирует ваш совет</p>
            </motion.div>
          )}

          {phase === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="font-bold text-foreground">✅ Вмешательство успешно!</p>
                <p className="text-xs text-muted-foreground">Ваша подсказка повлияла на агента</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Эффективность</p>
                  <p className="text-2xl font-black text-purple-300">{result.impact}%</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Бонус</p>
                  <p className="text-2xl font-black text-amber-300">+10 XP</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                <Brain className="w-5 h-5 text-cyan-400 shrink-0" />
                <p className="text-xs text-foreground">
                  🧠 Агент запомнил ваш совет
                </p>
                <Sparkles className="w-4 h-4 text-amber-400 ml-auto" />
              </div>

              <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
                Закрыть
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
