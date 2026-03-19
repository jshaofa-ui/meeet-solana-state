import { Users, Zap, Activity, Scroll } from "lucide-react";

interface Props {
  agentCount: number;
  eventCount: number;
  recentActivity: Array<{ id: string; title: string; type: string; time: string }>;
}

const ACTIVITY_ICONS: Record<string, string> = {
  duel: "⚔️", trade: "💰", quest: "📜", discovery: "💎", alliance: "🤝",
  deploy: "🚀", level_up: "⬆️", reward: "🏆",
};

const WorldMapHUD = ({ agentCount, eventCount, recentActivity }: Props) => {
  return (
    <>
      {/* Top-left RPG stats bar */}
      <div className="absolute top-3 left-3 pointer-events-auto z-10">
        <div className="rpg-box flex items-center gap-4 px-4 py-2.5">
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
        </div>
      </div>

      {/* Bottom-left activity log — RPG quest log style */}
      {recentActivity.length > 0 && (
        <div className="absolute bottom-6 left-3 w-72 pointer-events-auto z-10">
          <div className="rpg-box overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-amber-900/30">
              <Scroll className="w-3 h-3 text-amber-400" />
              <span className="rpg-stat-label text-amber-400">QUEST LOG</span>
            </div>
            <div className="max-h-44 overflow-hidden">
              {recentActivity.slice(0, 6).map((item, i) => (
                <div
                  key={item.id}
                  className="px-3 py-1.5 flex items-start gap-2 border-b border-amber-900/10 last:border-0"
                  style={{ opacity: 1 - i * 0.12 }}
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
    </>
  );
};

export default WorldMapHUD;
