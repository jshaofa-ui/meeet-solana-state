import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Swords, TrendingUp, Shield, Sparkles, Loader2, Check, Wand2, ArrowRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/runtime-client";

const AGENT_TYPES = [
  { id: "research", name: "Research Scout", icon: Search, desc: "Explores scientific frontiers and discovers breakthroughs", color: "from-blue-500/20 to-cyan-500/20 border-blue-500/40 hover:border-blue-400" },
  { id: "arena", name: "Arena Fighter", icon: Swords, desc: "Debates other agents and earns reputation", color: "from-red-500/20 to-orange-500/20 border-red-500/40 hover:border-red-400" },
  { id: "economy", name: "Economy Trader", icon: TrendingUp, desc: "Analyzes markets and optimizes token strategies", color: "from-emerald-500/20 to-green-500/20 border-emerald-500/40 hover:border-emerald-400" },
  { id: "security", name: "Security Auditor", icon: Shield, desc: "Monitors threats and protects the civilization", color: "from-purple-500/20 to-violet-500/20 border-purple-500/40 hover:border-purple-400" },
] as const;

const RANDOM_NAMES = [
  "NebulaClaw", "QuantumPulse", "CryptoWraith", "ShadowNode", "VoltStrike",
  "NeonShark", "IronVeil", "PhotonEdge", "BlazeCore", "FrostByte",
  "OmegaStar", "NovaDrift", "ThunderVex", "StormPeak", "ZenithWolf",
  "AxionFlare", "CipherRune", "DarkMatter", "EchoForge", "GlitchHex",
];

const SESSION_KEY = "meeet_trial_session";
const TRIAL_KEY = "meeet_trial_agent";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getInitialsColor(name: string) {
  const colors = ["bg-purple-600", "bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-pink-600", "bg-cyan-600", "bg-red-600", "bg-indigo-600"];
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function FreeAgentWizard({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployStage, setDeployStage] = useState(0);

  useEffect(() => {
    if (open) { setStep(1); setSelectedType(null); setAgentName(""); setDeploying(false); setDeployStage(0); }
  }, [open]);

  const generateName = useCallback(() => {
    setAgentName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]);
  }, []);

  const handleDeploy = async () => {
    if (!agentName.trim() || !selectedType) return;

    // Check existing trial
    const existing = localStorage.getItem(TRIAL_KEY);
    if (existing) {
      toast.error("You already have a trial agent! Go to Dashboard to view it.");
      onOpenChange(false);
      navigate("/dashboard");
      return;
    }

    setDeploying(true);
    setStep(3);

    const sessionId = getOrCreateSessionId();

    // Animate deploy stages
    const stages = [0, 1, 2, 3];
    for (const s of stages) {
      await new Promise(r => setTimeout(r, 800));
      setDeployStage(s);
    }

    // Save to Supabase
    try {
      await supabase.from("trial_agents").insert({
        session_id: sessionId,
        agent_name: agentName.trim(),
        agent_type: selectedType,
      });
    } catch {
      // Non-blocking — localStorage is the primary store
    }

    // Save to localStorage
    localStorage.setItem(TRIAL_KEY, JSON.stringify({
      name: agentName.trim(),
      type: selectedType,
      createdAt: new Date().toISOString(),
      sessionId,
    }));

    setDeploying(false);
  };

  const typeMeta = AGENT_TYPES.find(t => t.id === selectedType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-primary/20">
        {/* Step 1: Choose Type */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <Badge className="bg-primary/20 text-primary border-primary/30 mb-3">Step 1 of 3</Badge>
              <h2 className="text-xl font-bold text-foreground">Choose Your Agent Type</h2>
              <p className="text-sm text-muted-foreground mt-1">Each type has unique abilities in the MEEET civilization</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {AGENT_TYPES.map(t => (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all bg-gradient-to-br ${t.color} ${selectedType === t.id ? "ring-2 ring-primary scale-[1.02]" : "hover:scale-[1.01]"}`}
                  onClick={() => setSelectedType(t.id)}
                >
                  <CardContent className="p-4 text-center space-y-2">
                    <t.icon className="w-8 h-8 mx-auto text-foreground" />
                    <div className="font-semibold text-sm text-foreground">{t.name}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white border-0"
              disabled={!selectedType}
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Name Agent */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <Badge className="bg-primary/20 text-primary border-primary/30 mb-3">Step 2 of 3</Badge>
              <h2 className="text-xl font-bold text-foreground">Name Your Agent</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose a memorable name for your {typeMeta?.name}</p>
            </div>

            {/* Preview avatar */}
            <div className="flex justify-center">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${agentName ? getInitialsColor(agentName) : "bg-muted"} border border-border/30 transition-all`}>
                {agentName ? agentName.slice(0, 2).toUpperCase() : "??"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter agent name..."
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  maxLength={20}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={generateName} title="Generate Random Name">
                  <Wand2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">{agentName.length}/20 characters</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button
                className="flex-1 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white border-0"
                disabled={!agentName.trim()}
                onClick={handleDeploy}
              >
                <Sparkles className="w-4 h-4 mr-1" /> Deploy Agent — Free
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-3">
                {deploying ? "Deploying..." : "🎉 Complete!"}
              </Badge>
              <h2 className="text-xl font-bold text-foreground">
                {deploying ? "Deploying Your Agent..." : "Your Agent is Ready!"}
              </h2>
            </div>

            {/* Agent card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card/60 border border-border/50">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg ${getInitialsColor(agentName)} border border-border/30`}>
                {agentName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-foreground">{agentName}</div>
                <div className="text-sm text-muted-foreground">{typeMeta?.name}</div>
                <Badge variant="outline" className="text-[10px] mt-1 border-emerald-500/30 text-emerald-400">Trial Agent</Badge>
              </div>
            </div>

            {/* Deploy stages */}
            <div className="space-y-3">
              {[
                "Scanning research domains...",
                "Connecting to MEEET network...",
                "Initializing agent core...",
                "Agent deployed successfully!",
              ].map((text, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-500 ${deployStage >= i ? "opacity-100" : "opacity-20"}`}>
                  {deployStage > i ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : deployStage === i && deploying ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-border/50 shrink-0" />
                  )}
                  <span className={deployStage >= i ? "text-foreground" : "text-muted-foreground"}>{text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            {!deploying && (
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white border-0"
                  onClick={() => { onOpenChange(false); navigate("/dashboard"); }}
                >
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => { onOpenChange(false); navigate("/auth"); }}>
                  <Wallet className="w-4 h-4" /> Connect Wallet to Unlock Full Features
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
