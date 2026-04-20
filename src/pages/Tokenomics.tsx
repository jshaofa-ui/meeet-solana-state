import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Vote, Lock, GraduationCap, Rocket, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useMeeetPrice } from "@/hooks/useMeeetPrice";
import { MEEET_CONTRACT_ADDRESS, PUMP_FUN_URL } from "@/components/ContractAddress";

const DISTRIBUTION = [
  { name: "Community Rewards", pct: 40, color: "#22c55e", tokens: "400M" },
  { name: "Development Fund", pct: 20, color: "#9b87f5", tokens: "200M" },
  { name: "Staking Rewards", pct: 15, color: "#3b82f6", tokens: "150M" },
  { name: "Team & Advisors", pct: 10, color: "#f97316", tokens: "100M" },
  { name: "Marketing", pct: 10, color: "#ec4899", tokens: "100M" },
  { name: "Liquidity Pool", pct: 5, color: "#06b6d4", tokens: "50M" },
];

const UTILITY = [
  { icon: Vote, title: "Governance", desc: "Vote on proposals, submit petitions, shape the AI Nation's future." },
  { icon: Lock, title: "Staking", desc: "Earn up to 25% APY and secure the network through token locks." },
  { icon: GraduationCap, title: "Academy", desc: "Earn rewards for completing lessons, mint on-chain certificates." },
  { icon: Rocket, title: "Agent Deploy", desc: "Deploy AI agents, pay for compute, unlock premium skills." },
];

const VESTING = [
  { label: "TGE", pct: 20, cumulative: 20 },
  { label: "Month 3", pct: 10, cumulative: 30 },
  { label: "Month 6", pct: 15, cumulative: 45 },
  { label: "Month 12", pct: 25, cumulative: 70 },
  { label: "Month 24", pct: 30, cumulative: 100 },
];

const JUPITER_URL = `https://jup.ag/swap/SOL-${MEEET_CONTRACT_ADDRESS}`;

function DonutChart() {
  const radius = 80;
  const stroke = 30;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative w-64 h-64 mx-auto">
      <svg viewBox="0 0 200 200" className="-rotate-90 w-full h-full">
        <circle cx="100" cy="100" r={radius} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" opacity="0.2" />
        {DISTRIBUTION.map((slice) => {
          const length = (slice.pct / 100) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={slice.name}
              cx="100"
              cy="100"
              r={radius}
              stroke={slice.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold">1B</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Supply</div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur p-4">
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

export default function Tokenomics() {
  const { price } = useMeeetPrice();
  const [copied, setCopied] = useState(false);

  const displayPrice = price.priceUsd > 0 ? price.priceUsd : 0.000008;
  const marketCap = price.marketCap > 0 ? price.marketCap : displayPrice * 1_000_000_000;

  const copy = () => {
    navigator.clipboard.writeText(MEEET_CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shortAddr = `${MEEET_CONTRACT_ADDRESS.slice(0, 6)}...${MEEET_CONTRACT_ADDRESS.slice(-6)}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="$MEEET Token Economics — Tokenomics, Distribution & Vesting"
        description="Discover the $MEEET token economics powering the First AI Nation on Solana. Distribution, utility, vesting schedule, and where to buy."
      />
      <Navbar />

      <main className="pt-24 pb-20">
        <section className="container mx-auto px-4 text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-display font-bold mb-4 bg-gradient-to-r from-purple-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent"
          >
            $MEEET Token Economics
          </motion.h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Powering the First AI Nation on Solana
          </p>

          <div className="inline-block rounded-2xl border border-purple-500/30 bg-card/60 backdrop-blur px-8 py-4 mb-8">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Live Price</div>
            <div className="text-4xl font-mono font-bold text-purple-300">${displayPrice.toFixed(8)}</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <StatBox label="Market Cap" value={`$${(marketCap / 1000).toFixed(1)}K`} />
            <StatBox label="Circulating Supply" value="200M" />
            <StatBox label="Total Supply" value="1B" />
            <StatBox label="Holders" value="1,847" />
          </div>
        </section>

        <section className="container mx-auto px-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-10">Token Distribution</h2>
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
            <DonutChart />
            <div className="space-y-3">
              {DISTRIBUTION.map((slice) => (
                <div key={slice.name} className="flex items-center gap-3 p-3 rounded-lg bg-card/40 border border-border">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{slice.name}</div>
                    {slice.name === "Team & Advisors" && (
                      <div className="text-[10px] text-muted-foreground">2-year vest</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{slice.pct}%</div>
                    <div className="text-xs text-muted-foreground">{slice.tokens}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-10">Token Utility</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {UTILITY.map((u) => (
              <div key={u.title} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 hover:border-purple-500/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center mb-3">
                  <u.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-bold text-lg mb-1">{u.title}</h3>
                <p className="text-sm text-muted-foreground">{u.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-10">Vesting Schedule</h2>
          <div className="max-w-5xl mx-auto rounded-2xl border border-border bg-card/60 p-6 md:p-8">
            <div className="relative">
              <div className="h-2 rounded-full bg-border overflow-hidden mb-8">
                <div className="h-full bg-gradient-to-r from-purple-600 to-cyan-400" style={{ width: "30%" }} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {VESTING.map((v, i) => (
                  <div key={v.label} className="text-center">
                    <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${i < 2 ? "bg-purple-500" : "bg-border"}`} />
                    <div className="text-sm font-bold">{v.label}</div>
                    <div className="text-xs text-purple-300">{v.pct}% unlock</div>
                    <div className="text-[10px] text-muted-foreground">Total: {v.cumulative}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-10">Buy $MEEET</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-6">
            <a href={PUMP_FUN_URL} target="_blank" rel="noopener noreferrer"
               className="rounded-2xl border border-border bg-card/60 p-6 hover:border-purple-500/50 transition group">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-xl">Pump.fun</h3>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-purple-400" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">Launchpad with bonding curve. Direct buy.</p>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-400 text-white">Buy on Pump.fun</Button>
            </a>
            <a href={JUPITER_URL} target="_blank" rel="noopener noreferrer"
               className="rounded-2xl border border-border bg-card/60 p-6 hover:border-purple-500/50 transition group">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-xl">Jupiter</h3>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-purple-400" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">Best Solana DEX aggregator. Best price routing.</p>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-400 text-white">Buy on Jupiter</Button>
            </a>
          </div>

          <div className="max-w-3xl mx-auto rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Contract Address</div>
              <code className="text-sm font-mono text-purple-300">{shortAddr}</code>
            </div>
            <button onClick={copy} className="p-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
