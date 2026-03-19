import { useState, useEffect, useRef, useCallback } from "react";
import { Scroll, Crosshair, Activity, AlertTriangle, Search, X, Navigation } from "lucide-react";

interface Props {
  agentCount: number;
  eventCount: number;
  warningCount: number;
  recentActivity: Array<{ id: string; title: string; type: string; time: string }>;
  onSearchAgent?: (name: string) => void;
  onClearFollow?: () => void;
  followingAgent?: string | null;
}

const ACTIVITY_ICONS: Record<string, string> = {
  duel: "⚔️", trade: "💰", quest: "📜", discovery: "💎", alliance: "🤝",
  deploy: "🚀", level_up: "⬆️", reward: "🏆", conflict: "⚔️",
  disaster: "🌋", diplomacy: "🕊️", warning: "⚠️",
};

const WorldMapHUD = ({ agentCount, eventCount, warningCount, recentActivity, onSearchAgent, onClearFollow, followingAgent }: Props) => {
  const [fps, setFps] = useState(60);
  const [tick, setTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const fpsRef = useRef({ lastTime: performance.now(), frameCount: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // FPS counter (throttled)
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      fpsRef.current.frameCount++;
      const now = performance.now();
      if (now - fpsRef.current.lastTime >= 1000) {
        setFps(fpsRef.current.frameCount);
        fpsRef.current.frameCount = 0;
        fpsRef.current.lastTime = now;
      }
      requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false; };
  }, []);

  // World tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const handleSearch = useCallback(() => {
    if (searchVal.trim() && onSearchAgent) {
      onSearchAgent(searchVal.trim());
      setSearchOpen(false);
      setSearchVal("");
    }
  }, [searchVal, onSearchAgent]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  // Day/night cycle indicator
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour < 20;
  const timeIcon = isDaytime ? "☀️" : "🌙";

  return (
    <>
      {/* Top-left stats */}
      <div className="absolute top-3 left-3 pointer-events-auto z-10">
        <div className="rpg-box flex items-center gap-3 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="rpg-dot bg-emerald-400" />
            <span className="rpg-stat-label">AGENTS</span>
            <span className="rpg-stat-value text-emerald-400">{agentCount}</span>
          </div>
          <div className="rpg-divider" />
          <div className="flex items-center gap-1.5">
            <span className="rpg-dot bg-amber-400" />
            <span className="rpg-stat-label">EVENTS</span>
            <span className="rpg-stat-value text-amber-400">{eventCount}</span>
          </div>
          {warningCount > 0 && (
            <>
              <div className="rpg-divider" />
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                <span className="rpg-stat-label">ALERTS</span>
                <span className="rpg-stat-value text-red-400">{warningCount}</span>
              </div>
            </>
          )}
          <div className="rpg-divider" />
          <div className="flex items-center gap-1.5">
            <Activity className="w-2.5 h-2.5 text-cyan-400" />
            <span className="rpg-stat-label">FPS</span>
            <span className={`rpg-stat-value ${fps > 30 ? "text-cyan-400" : fps > 15 ? "text-amber-400" : "text-red-400"}`}>
              {fps}
            </span>
          </div>
        </div>
      </div>

      {/* Top-right — Clock & Search */}
      <div className="absolute top-3 right-56 pointer-events-auto z-10 flex items-center gap-2">
        {/* Search */}
        {searchOpen ? (
          <div className="rpg-box flex items-center gap-1 px-2 py-1.5">
            <Search className="w-3 h-3 text-amber-400/50" />
            <input
              ref={searchInputRef}
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Agent name..."
              className="bg-transparent border-none outline-none text-amber-100/80 text-[10px] font-mono w-28 placeholder:text-amber-100/20"
            />
            <button onClick={() => { setSearchOpen(false); setSearchVal(""); }} className="text-amber-100/30 hover:text-amber-100/60">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => setSearchOpen(true)} className="rpg-box-btn p-1.5" title="Search agent">
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="rpg-box flex items-center gap-3 px-3 py-2">
          <span className="text-xs">{timeIcon}</span>
          <Crosshair className="w-3 h-3 text-amber-400/50" />
          <span className="rpg-stat-label">TICK</span>
          <span className="rpg-stat-value text-amber-300 tabular-nums">{String(tick).padStart(5, '0')}</span>
        </div>
      </div>

      {/* Following indicator */}
      {followingAgent && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-auto z-10 animate-fade-in">
          <div className="rpg-box flex items-center gap-2 px-3 py-1.5">
            <Navigation className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="text-[10px] font-mono text-amber-100/70">TRACKING: </span>
            <span className="text-[11px] font-mono font-bold text-amber-400">{followingAgent}</span>
            <button onClick={onClearFollow} className="text-amber-100/30 hover:text-red-400 transition-colors ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Quest log */}
      {recentActivity.length > 0 && (
        <div className="absolute bottom-6 left-3 w-72 pointer-events-auto z-10">
          <div className="rpg-box overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-amber-900/30">
              <Scroll className="w-3 h-3 text-amber-400" />
              <span className="rpg-stat-label text-amber-400">QUEST LOG</span>
              <span className="ml-auto rpg-stat-label text-amber-400/40">LIVE</span>
              <span className="rpg-dot bg-red-400 w-1.5 h-1.5" />
            </div>
            <div className="max-h-52 overflow-hidden">
              {recentActivity.slice(0, 8).map((item, i) => (
                <div
                  key={item.id}
                  className="px-3 py-1.5 flex items-start gap-2 border-b border-amber-900/10 last:border-0 hover:bg-amber-400/5 transition-colors"
                  style={{ opacity: 1 - i * 0.08 }}
                >
                  <span className="text-sm mt-0.5 shrink-0">
                    {ACTIVITY_ICONS[item.type] || "📌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] leading-snug line-clamp-1 text-amber-100/80 font-mono">
                      {item.title}
                    </p>
                    <span className="text-[8px] text-amber-100/30 font-mono">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compass + Minimap */}
      <div className="absolute bottom-6 right-3 pointer-events-auto z-10">
        <div className="rpg-box w-24 h-24 flex items-center justify-center relative overflow-hidden">
          {/* Compass circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border border-amber-400/10 rounded-full" />
            <div className="absolute w-10 h-10 border border-amber-400/05 rounded-full" />
          </div>
          {/* Cardinal directions */}
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[7px] font-mono text-amber-400/60 font-bold">N</span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-mono text-amber-400/30">S</span>
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[7px] font-mono text-amber-400/30">W</span>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-mono text-amber-400/30">E</span>
          {/* Center crosshair */}
          <div className="w-2 h-[1px] bg-amber-400/40 absolute" />
          <div className="w-[1px] h-2 bg-amber-400/40 absolute" />
          <div className="w-1 h-1 bg-amber-400 absolute" style={{ imageRendering: "pixelated" }} />
          {/* Stats in minimap */}
          <span className="absolute bottom-1 right-1.5 text-[6px] font-mono text-emerald-400/60 font-bold">{agentCount}A</span>
          <span className="absolute bottom-1 left-1.5 text-[6px] font-mono text-amber-400/40">{eventCount}E</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto z-10">
        <div className="rpg-box px-4 py-1 flex items-center gap-4">
          <span className="text-[7px] font-mono text-amber-100/20 tracking-widest">
            MEEET WORLD v5.1 — PIXEL REALM
          </span>
          <div className="rpg-divider h-3" />
          <span className="text-[7px] font-mono text-amber-100/20 tracking-widest">
            {new Date().toLocaleDateString()}
          </span>
          {warningCount > 0 && (
            <>
              <div className="rpg-divider h-3" />
              <span className="text-[7px] font-mono text-red-400/50 tracking-widest animate-pulse">
                ⚠ {warningCount} ACTIVE ALERTS
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default WorldMapHUD;
