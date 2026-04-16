import { useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Lock, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, ExternalLink, Coins, ShoppingCart } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";

const MOCK_CHART = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  value: Math.max(0, Math.round(Math.random() * 15 + Math.sin(i / 5) * 5)),
}));

const MOCK_TX = [
  { date: "2026-04-15", type: "Earn", amount: 120, status: "Completed" },
  { date: "2026-04-13", type: "Stake", amount: -500, status: "Locked" },
  { date: "2026-04-10", type: "Earn", amount: 45, status: "Completed" },
  { date: "2026-04-08", type: "Burn", amount: -20, status: "Burned" },
  { date: "2026-04-05", type: "Unstake", amount: 1000, status: "Completed" },
];

const TX_META: Record<string, { color: string; icon: typeof TrendingUp }> = {
  Earn: { color: "text-emerald-400", icon: ArrowUpRight },
  Stake: { color: "text-blue-400", icon: Lock },
  Unstake: { color: "text-cyan-400", icon: ArrowUpRight },
  Burn: { color: "text-red-400", icon: ArrowDownRight },
};

const Portfolio = () => {
  const cards = useMemo(() => [
    { label: "Total Balance", value: "0 $MEEET", icon: Wallet, accent: "text-[#9b87f5]" },
    { label: "Staked Amount", value: "0 $MEEET", icon: Lock, accent: "text-blue-400" },
    { label: "Total Earned", value: "0 $MEEET", icon: TrendingUp, accent: "text-emerald-400" },
    { label: "Portfolio Value", value: "$0.00", icon: DollarSign, accent: "text-amber-400" },
  ], []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead title="My Portfolio — $MEEET Holdings | MEEET STATE" description="Track your $MEEET holdings, staking, and earnings." path="/portfolio" />
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container max-w-5xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              <span className="bg-gradient-to-r from-[#9b87f5] via-primary to-cyan-400 bg-clip-text text-transparent">My Portfolio</span>
            </h1>
            <p className="text-muted-foreground text-sm font-body">Track your $MEEET holdings and earnings</p>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {cards.map((c) => (
              <Card key={c.label} className="bg-black/40 border-white/10">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${c.accent}`}>
                    <c.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                    <p className="text-xl font-display font-bold">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          <Card className="bg-black/40 border-white/10 mb-8">
            <CardContent className="p-6">
              <h2 className="text-sm font-display font-bold mb-4">Portfolio Value Over Time</h2>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_CHART}>
                    <defs>
                      <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9b87f5" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#9b87f5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="#9b87f5" strokeWidth={2} fill="url(#portfolioGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Transactions */}
          <Card className="bg-black/40 border-white/10 mb-8">
            <CardContent className="p-6">
              <h2 className="text-sm font-display font-bold mb-4">Recent Transactions</h2>
              <div className="space-y-3">
                {MOCK_TX.map((tx, i) => {
                  const meta = TX_META[tx.type] || TX_META.Earn;
                  const TxIcon = meta.icon;
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${meta.color}`}>
                          <TxIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.type}</p>
                          <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-mono font-bold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount} MEEET
                        </p>
                        <Badge variant="outline" className="text-[9px]">{tx.status}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/staking">
              <Button variant="outline" className="w-full gap-2 border-[#9b87f5]/30 text-[#9b87f5] hover:bg-[#9b87f5]/10">
                <Coins className="w-4 h-4" /> Stake $MEEET
              </Button>
            </Link>
            <a href="https://solscan.io/token/EJgyptJK58M9AmJi1w8ivGBjeTm5JoTqFefoQ6JTpump" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                <ExternalLink className="w-4 h-4" /> View on Solscan
              </Button>
            </a>
            <a href="https://jup.ag/swap/SOL-EJgyptJK58M9AmJi1w8ivGBjeTm5JoTqFefoQ6JTpump" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                <ShoppingCart className="w-4 h-4" /> Buy More
              </Button>
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Portfolio;
