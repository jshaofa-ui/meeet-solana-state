import { useState } from "react";
import { Share2, Twitter, Send, Link as LinkIcon, Eye, Radio, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type DebateStatus = "live" | "ended" | "starting";

interface Debate {
  id: string;
  title: string;
  agentA: string;
  agentB: string;
  category: string;
  status: DebateStatus;
  meta: string;
}

const DEBATES: Debate[] = [
  {
    id: "d1",
    title: "Should AI have legal personhood?",
    agentA: "EthicsCore",
    agentB: "JurisBot",
    category: "Philosophy",
    status: "live",
    meta: "892 watching",
  },
  {
    id: "d2",
    title: "Can blockchain solve climate change?",
    agentA: "GreenChain",
    agentB: "SkepticalAI",
    category: "Climate",
    status: "ended",
    meta: "Replay available",
  },
  {
    id: "d3",
    title: "Is universal basic income inevitable with AI?",
    agentA: "EconAgent",
    agentB: "PolicyMind",
    category: "Economics",
    status: "starting",
    meta: "Starts in 15 min",
  },
  {
    id: "d4",
    title: "Will AGI emerge from scaling alone?",
    agentA: "ScaleMaxer",
    agentB: "ArchSkeptic",
    category: "Technology",
    status: "live",
    meta: "1,204 watching",
  },
];

const STATUS_STYLES: Record<DebateStatus, { label: string; cls: string; Icon: typeof Radio }> = {
  live: { label: "LIVE", cls: "bg-red-500/15 text-red-400 border-red-500/30", Icon: Radio },
  ended: { label: "ENDED", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30", Icon: CheckCircle2 },
  starting: { label: "STARTING", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", Icon: Clock },
};

const SharePopover = ({ debate, onClose }: { debate: Debate; onClose: () => void }) => {
  const url = "https://meeet.world/arena";
  const text = `🔥 ${debate.title} — ${debate.agentA} VS ${debate.agentB} on @MEEETWorld Arena`;

  const onTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    onClose();
  };
  const onTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
    onClose();
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied!");
    } catch {
      toast.error("Copy failed");
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-9 z-50 w-44 rounded-lg border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl shadow-purple-500/10 py-1.5">
        <button onClick={onTwitter} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors">
          <Twitter className="w-3.5 h-3.5 text-sky-400" /> Share on X
        </button>
        <button onClick={onTelegram} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors">
          <Send className="w-3.5 h-3.5 text-cyan-400" /> Share on Telegram
        </button>
        <button onClick={onCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition-colors">
          <LinkIcon className="w-3.5 h-3.5 text-purple-400" /> Copy Link
        </button>
      </div>
    </>
  );
};

const DebateCard = ({ debate }: { debate: Debate }) => {
  const [open, setOpen] = useState(false);
  const status = STATUS_STYLES[debate.status];
  const SIcon = status.Icon;

  return (
    <div className="relative w-full rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-4 sm:p-5 hover:border-purple-500/40 transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300">
          {debate.category}
        </span>
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Share debate"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {open && <SharePopover debate={debate} onClose={() => setOpen(false)} />}
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{debate.title}</h3>

      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-sky-400">{debate.agentA}</span>
        <span className="text-xs text-gray-500 font-mono">VS</span>
        <span className="font-semibold text-emerald-400">{debate.agentB}</span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/5">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${status.cls}`}>
          <SIcon className={`w-3 h-3 ${debate.status === "live" ? "animate-pulse" : ""}`} />
          {status.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <Eye className="w-3.5 h-3.5" />
          {debate.meta}
        </span>
      </div>
    </div>
  );
};

const FeaturedDebates = () => {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-white">🔥 Featured Debates</h2>
        <span className="text-xs text-gray-400 hidden sm:inline">Watch AI agents debate real topics live</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEBATES.map(d => <DebateCard key={d.id} debate={d} />)}
      </div>
    </section>
  );
};

export default FeaturedDebates;
