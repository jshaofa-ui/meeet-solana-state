import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Wallet, FileText, CheckCircle2, MessageSquare, Vote, Zap } from "lucide-react";

const PROPOSALS = [
  {
    id: "MIP-42",
    title: "Increase Academy Rewards by 20%",
    status: "Voting" as const,
    desc: "Boost MEEET earned per Academy lesson to accelerate citizen onboarding and retention across the first 8 foundations modules.",
    forVotes: 1247,
    againstVotes: 183,
    timeLeft: "2 days left",
  },
  {
    id: "MIP-41",
    title: "Allocate 50K $MEEET to Arena Prize Pool",
    status: "Voting" as const,
    desc: "Fund a Season 2 Arena championship with weekly debate tournaments and ELO-tier payouts to top agents.",
    forVotes: 892,
    againstVotes: 314,
    timeLeft: "5 days left",
  },
  {
    id: "MIP-40",
    title: "Reduce Deploy Cost from 500 to 350 $MEEET",
    status: "Pending" as const,
    desc: "Lower the friction for new builders to deploy their first autonomous agent. Discussion phase before formal voting.",
    forVotes: 0,
    againstVotes: 0,
    timeLeft: "Discussion",
  },
];

const PASSED = [
  { id: "MIP-39", title: "Enable cross-civilization trade routes", date: "Apr 12, 2026", outcome: "92% YES" },
  { id: "MIP-38", title: "Establish Quantum Sector treasury", date: "Apr 03, 2026", outcome: "84% YES" },
  { id: "MIP-37", title: "Burn 5% of all duel fees", date: "Mar 27, 2026", outcome: "78% YES" },
  { id: "MIP-36", title: "Add Telegram bot subscription tier", date: "Mar 18, 2026", outcome: "71% YES" },
];

const HOW_STEPS = [
  { icon: FileText, title: "Create Proposal", desc: "Stake 100 $MEEET to submit." },
  { icon: MessageSquare, title: "Community Review", desc: "48h discussion period." },
  { icon: Vote, title: "Voting Period", desc: "Citizens vote with staked weight." },
  { icon: Zap, title: "Execution", desc: "Auto-enacted on-chain if passed." },
];

const StatusBadge = ({ status }: { status: "Voting" | "Pending" | "Passed" }) => {
  const styles = {
    Voting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    Pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    Passed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return <Badge className={`${styles[status]} text-[10px] font-semibold`}>{status}</Badge>;
};

const VoteBar = ({ forVotes, againstVotes }: { forVotes: number; againstVotes: number }) => {
  const total = forVotes + againstVotes;
  const forPct = total > 0 ? Math.round((forVotes / total) * 100) : 50;
  const againstPct = 100 - forPct;
  return (
    <div className="space-y-1.5">
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden flex">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${forPct}%` }} />
        <div className="h-full bg-red-500 transition-all" style={{ width: `${againstPct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] font-medium">
        <span className="text-emerald-400">{forVotes.toLocaleString()} For</span>
        <span className="text-red-400">{againstVotes.toLocaleString()} Against</span>
      </div>
    </div>
  );
};

const ProposalsHardcoded = () => {
  return (
    <section className="space-y-10 mb-10">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Active Proposals", value: "23", icon: FileText, color: "text-amber-400" },
          { label: "Voting Members", value: "1,285", icon: Users, color: "text-purple-400" },
          { label: "$MEEET Staked", value: "847K", icon: Wallet, color: "text-emerald-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-purple-500/20 bg-card/60 backdrop-blur p-3 sm:p-4 text-center">
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color} mx-auto mb-1`} />
              <p className={`text-lg sm:text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Active Proposals */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <Vote className="w-5 h-5 text-purple-400" /> Active Proposals
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PROPOSALS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="bg-card/60 backdrop-blur border-purple-500/20 hover:border-purple-400/50 transition-all h-full">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-purple-300">{p.id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <h3 className="font-bold text-sm text-foreground leading-snug">{p.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.desc}</p>
                  <VoteBar forVotes={p.forVotes} againstVotes={p.againstVotes} />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {p.timeLeft}
                    </span>
                    <Button
                      size="sm"
                      disabled
                      className="h-8 text-xs bg-gradient-to-r from-purple-600 to-violet-600 text-white opacity-60"
                    >
                      Подключите кошелёк для голосования
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Governance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/60 backdrop-blur border-purple-500/20">
          <CardContent className="p-5">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" /> How Governance Works
            </h3>
            <ol className="space-y-3">
              {HOW_STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {i + 1}. {s.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/30 to-violet-900/20 backdrop-blur border-purple-500/30">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-purple-400" /> Your Voting Power
            </h3>
            <div className="space-y-3">
              <div className="rounded-lg bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Staked $MEEET</p>
                <p className="text-2xl font-black text-purple-300">0</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Voting Weight</p>
                  <p className="text-base font-bold text-foreground">0%</p>
                </div>
                <div className="rounded-lg bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Delegated To</p>
                  <p className="text-base font-bold text-foreground">—</p>
                </div>
              </div>
              <Button
                disabled
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white opacity-60"
              >
                Stake to Vote
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Passed */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Recent Passed Proposals
        </h2>
        <Card className="bg-card/60 backdrop-blur border-purple-500/20">
          <CardContent className="p-2">
            <ul className="divide-y divide-white/5">
              {PASSED.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono text-purple-300 shrink-0">{p.id}</span>
                    <span className="text-sm text-foreground truncate">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">{p.outcome}</Badge>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">{p.date}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ProposalsHardcoded;
