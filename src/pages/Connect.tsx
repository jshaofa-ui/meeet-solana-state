import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, Check, Copy, Loader2, Vote, Lock, Bot, Gift, LogOut } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Round 17 complete

const WALLETS = [
  { id: "phantom", name: "Phantom", desc: "Most popular Solana wallet", color: "from-purple-500 to-purple-700", emoji: "👻" },
  { id: "solflare", name: "Solflare", desc: "Advanced Solana wallet", color: "from-orange-400 to-orange-600", emoji: "🔥" },
  { id: "backpack", name: "Backpack", desc: "Multi-chain wallet", color: "from-blue-500 to-blue-700", emoji: "🎒" },
  { id: "walletconnect", name: "WalletConnect", desc: "Connect any wallet", color: "from-cyan-400 to-cyan-600", emoji: "🔗" },
] as const;

const BENEFITS = [
  { icon: Vote, title: "Vote on Proposals", desc: "Shape governance decisions" },
  { icon: Lock, title: "Stake $MEEET", desc: "Earn up to 25% APY" },
  { icon: Bot, title: "Deploy Agents", desc: "Launch your own AI agents" },
  { icon: Gift, title: "Earn Rewards", desc: "Daily quests & airdrops" },
];

const STORAGE_KEY = "meeet_wallet_connected";
const ADDR_KEY = "meeet_wallet_address";

const randomAddress = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export default function Connect() {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<{ wallet: string; address: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const wallet = localStorage.getItem(STORAGE_KEY);
    const address = localStorage.getItem(ADDR_KEY);
    if (wallet && address) setConnected({ wallet, address });
  }, []);

  const handleConnect = (id: string, name: string) => {
    setConnecting(id);
    setTimeout(() => {
      const address = randomAddress();
      localStorage.setItem(STORAGE_KEY, name);
      localStorage.setItem(ADDR_KEY, address);
      setConnected({ wallet: name, address });
      setConnecting(null);
      toast.success(`${name} connected!`);
    }, 1200);
  };

  const handleDisconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ADDR_KEY);
    setConnected(null);
    toast.info("Wallet disconnected");
  };

  const copyAddr = () => {
    if (!connected) return;
    navigator.clipboard.writeText(connected.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncate = (a: string) => `${a.slice(0, 6)}...${a.slice(-6)}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="Connect Wallet — MEEET"
        description="Link your Solana wallet to MEEET — vote on proposals, stake $MEEET, deploy agents, and earn rewards."
        path="/connect"
      />
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <section className="max-w-3xl mx-auto text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black tracking-tight"
          >
            Connect to <span className="bg-gradient-to-r from-[#9b87f5] via-[#7E69AB] to-[#6E59A5] bg-clip-text text-transparent">MEEET</span>
          </motion.h1>
          <p className="mt-4 text-muted-foreground text-base md:text-lg">
            Link your Solana wallet to unlock the full experience
          </p>
        </section>

        {connected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto"
          >
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent backdrop-blur p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold">Wallet Connected</h2>
              <p className="text-sm text-muted-foreground mt-1">{connected.wallet}</p>

              <div className="mt-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 font-mono text-sm">
                <span className="flex-1 text-left truncate">{truncate(connected.address)}</span>
                <button onClick={copyAddr} className="p-1.5 rounded hover:bg-muted transition-colors" aria-label="Copy address">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-4 flex items-baseline justify-between px-1">
                <span className="text-sm text-muted-foreground">Balance</span>
                <span className="text-lg font-bold text-[#9b87f5]">0 $MEEET</span>
              </div>

              <Button variant="outline" onClick={handleDisconnect} className="w-full mt-5 gap-2">
                <LogOut className="w-4 h-4" /> Disconnect Wallet
              </Button>
            </div>
          </motion.div>
        ) : (
          <section className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur p-6">
              <div className="flex items-center gap-2 mb-5">
                <Wallet className="w-5 h-5 text-[#9b87f5]" />
                <h2 className="text-lg font-bold">Choose Your Wallet</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WALLETS.map((w) => {
                  const isConnecting = connecting === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => handleConnect(w.id, w.name)}
                      disabled={!!connecting}
                      className="group relative rounded-xl border border-border bg-background/40 hover:border-[#9b87f5]/60 hover:bg-[#9b87f5]/5 transition-all p-4 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${w.color} flex items-center justify-center text-xl mb-3`}>
                        {w.emoji}
                      </div>
                      <div className="font-bold">{w.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{w.desc}</div>
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#9b87f5]">
                        {isConnecting ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                        ) : (
                          <>Connect →</>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-center mb-6">Why Connect?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-xl border border-border bg-card/40 backdrop-blur p-4 text-center hover:border-[#9b87f5]/40 transition-colors">
                <div className="w-10 h-10 mx-auto rounded-lg bg-[#9b87f5]/15 flex items-center justify-center mb-2">
                  <b.icon className="w-5 h-5 text-[#9b87f5]" />
                </div>
                <div className="font-bold text-sm">{b.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
