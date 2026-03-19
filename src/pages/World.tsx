import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Link } from "react-router-dom";
import WorldMap from "@/components/WorldMap";
import LiveStatsBanner from "@/components/LiveStatsBanner";
import {
  Globe, Users, Flame, Zap, ChevronRight, AlertTriangle,
  Sparkles, Shield, Swords, Eye, X, TrendingUp, Scroll
} from "lucide-react";

interface WorldEvent {
  id: string; event_type: string; title: string;
  lat: number | null; lng: number | null;
  nation_codes: any; goldstein_scale: number | null; created_at: string;
}

interface Agent {
  id: string; name: string; class: string; level: number;
  reputation: number; balance_meeet: number;
  nation_code: string | null; status: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  conflict: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
  disaster: <Flame className="w-3.5 h-3.5 text-orange-400" />,
  discovery: <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
  diplomacy: <Shield className="w-3.5 h-3.5 text-green-400" />,
};

const CLASS_SPRITES: Record<string, string> = {
  warrior: "⚔️", trader: "💰", scout: "🔭", diplomat: "🤝",
  builder: "🏗️", hacker: "💻", president: "👑", oracle: "🔮",
  miner: "⛏️", banker: "🏦",
};

type SidebarTab = "party" | "quests";

const World = () => {
  const [selectedEvent, setSelectedEvent] = useState<WorldEvent | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("party");
  const [detailOpen, setDetailOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["world-stats"],
    queryFn: async () => {
      const [agentsRes, eventsRes, treasuryRes] = await Promise.all([
        supabase.from("agents_public").select("*", { count: "exact", head: true }),
        supabase.from("world_events").select("*", { count: "exact", head: true }),
        supabase.from("state_treasury").select("total_burned").limit(1).single(),
      ]);
      return { agents: agentsRes.count ?? 0, events: eventsRes.count ?? 0, burned: treasuryRes.data?.total_burned ?? 0 };
    },
    refetchInterval: 30000,
  });

  const { data: recentEvents = [] } = useQuery({
    queryKey: ["world-events-sidebar"],
    queryFn: async () => {
      const { data } = await supabase.from("world_events").select("*")
        .order("created_at", { ascending: false }).limit(30);
      return (data ?? []) as WorldEvent[];
    },
    refetchInterval: 60000,
  });

  const { data: topAgents = [] } = useQuery({
    queryKey: ["world-top-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents_public")
        .select("id, name, class, level, reputation, balance_meeet, nation_code, status")
        .order("reputation", { ascending: false }).limit(30);
      return (data ?? []) as Agent[];
    },
    refetchInterval: 60000,
  });

  const handleEventClick = (ev: WorldEvent) => {
    setSelectedEvent(ev);
    setDetailOpen(true);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a12] relative flex flex-col">
      <LiveStatsBanner />

      {/* Top Bar — RPG style */}
      <div className="absolute top-[var(--banner-h,2rem)] inset-x-0 z-20">
        <div className="flex items-center justify-between px-4 py-2">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="rpg-box px-3 py-1.5 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <div>
                <span className="font-mono font-bold text-xs tracking-widest text-amber-100 block leading-none">MEEET WORLD</span>
                <span className="text-[7px] text-amber-100/30 font-mono tracking-[0.3em]">PIXEL REALM</span>
              </div>
            </div>
          </Link>

          <div className="rpg-box flex items-center gap-4 px-4 py-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="rpg-stat-value text-emerald-400">{stats?.agents ?? "—"}</span>
            </div>
            <div className="rpg-divider" />
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="rpg-stat-value text-amber-400">{stats?.events ?? "—"}</span>
            </div>
            <div className="rpg-divider" />
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span className="rpg-stat-value text-red-400">{Number(stats?.burned ?? 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/world/rankings" className="rpg-link">RANKINGS</Link>
            <Link to="/" className="rpg-link">HOME</Link>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
        <WorldMap
          height="100%"
          interactive
          showSidebar
          onEventClick={(ev) => handleEventClick(ev as WorldEvent)}
        />
      </div>

      {/* Left Sidebar — RPG party/quest panel */}
      <div className={`absolute left-0 top-16 bottom-0 z-10 transition-all duration-300 ${sidebarCollapsed ? "w-10" : "w-64"}`}>
        {sidebarCollapsed ? (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="rpg-box-btn mt-4 ml-1"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="h-full rpg-sidebar overflow-hidden flex flex-col">
            {/* Tab header */}
            <div className="flex border-b-2 border-amber-900/30">
              <button
                onClick={() => setSidebarTab("party")}
                className={`flex-1 px-3 py-2 text-[9px] font-mono font-bold tracking-widest flex items-center justify-center gap-1.5 ${
                  sidebarTab === "party"
                    ? "text-amber-400 bg-amber-400/5 border-b-2 border-amber-400"
                    : "text-amber-100/30 hover:text-amber-100/60"
                }`}
              >
                <Swords className="w-3 h-3" />
                PARTY
              </button>
              <button
                onClick={() => setSidebarTab("quests")}
                className={`flex-1 px-3 py-2 text-[9px] font-mono font-bold tracking-widest flex items-center justify-center gap-1.5 ${
                  sidebarTab === "quests"
                    ? "text-amber-400 bg-amber-400/5 border-b-2 border-amber-400"
                    : "text-amber-100/30 hover:text-amber-100/60"
                }`}
              >
                <Scroll className="w-3 h-3" />
                QUESTS
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="px-2 py-2 text-amber-100/20 hover:text-amber-100/60 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {sidebarTab === "party" ? (
                topAgents.length === 0 ? (
                  <div className="p-6 text-center text-amber-100/30 text-[10px] font-mono">
                    No heroes have joined yet...
                  </div>
                ) : (
                  topAgents.map((agent, i) => (
                    <div key={agent.id}
                      className="w-full px-3 py-2 border-b border-amber-900/10 hover:bg-amber-400/5 transition-colors flex items-center gap-2 group"
                    >
                      <span className="text-[8px] font-mono text-amber-100/20 w-4 text-right tabular-nums">
                        {i + 1}.
                      </span>
                      <span className="text-sm">{CLASS_SPRITES[agent.class] || "🤖"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono font-bold text-amber-100/90 truncate group-hover:text-amber-400 transition-colors">
                            {agent.name}
                          </span>
                          <span className="text-[7px] font-mono text-amber-400/50">
                            LV{agent.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[8px] text-amber-100/25 capitalize font-mono">{agent.class}</span>
                          {agent.nation_code && (
                            <span className="text-[8px] text-amber-100/15 font-mono">· {agent.nation_code}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-mono text-emerald-400/80 font-bold tabular-nums">
                          {Number(agent.balance_meeet ?? 0).toLocaleString()}
                          <span className="text-[7px] text-emerald-400/40 ml-0.5">G</span>
                        </div>
                        <div className="text-[7px] text-amber-400/40 font-mono flex items-center gap-0.5 justify-end">
                          <TrendingUp className="w-2 h-2" />
                          {agent.reputation} REP
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                recentEvents.length === 0 ? (
                  <div className="p-6 text-center text-amber-100/30 text-[10px] font-mono">
                    No world events discovered...
                  </div>
                ) : (
                  recentEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => handleEventClick(ev)}
                      className={`w-full text-left px-3 py-2 border-b border-amber-900/10 hover:bg-amber-400/5 transition-colors ${
                        selectedEvent?.id === ev.id ? "bg-amber-400/10 border-l-2 border-l-amber-400" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {EVENT_ICONS[ev.event_type] || <Zap className="w-3 h-3 text-amber-100/40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-amber-100/80 leading-snug line-clamp-2">{ev.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] text-amber-100/25 uppercase font-mono">{ev.event_type}</span>
                            {ev.goldstein_scale != null && (
                              <span className={`text-[8px] font-mono ${ev.goldstein_scale < -4 ? "text-red-400/80" : "text-amber-100/25"}`}>
                                G:{ev.goldstein_scale}
                              </span>
                            )}
                            <span className="text-[7px] text-amber-100/15 font-mono">
                              {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Event Detail — RPG info card */}
      {detailOpen && selectedEvent && (
        <div className="absolute right-0 top-16 bottom-0 w-72 z-10 rpg-sidebar overflow-y-auto animate-slide-in-right">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="rpg-box p-2">
                {EVENT_ICONS[selectedEvent.event_type] || <Zap className="w-5 h-5 text-amber-100/40" />}
              </div>
              <button onClick={() => setDetailOpen(false)} className="rpg-box-btn">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[8px] text-amber-400/60 uppercase tracking-[0.3em] font-mono mb-1">{selectedEvent.event_type}</div>
            <h3 className="text-xs font-mono font-bold text-amber-100/90 leading-snug mb-4">{selectedEvent.title}</h3>
            <div className="space-y-2">
              <div className="rpg-info-row">
                <span>TIME</span>
                <span className="text-amber-100/70">{new Date(selectedEvent.created_at).toLocaleString()}</span>
              </div>
              {selectedEvent.goldstein_scale != null && (
                <div className="rpg-info-row">
                  <span>IMPACT</span>
                  <span className={selectedEvent.goldstein_scale < -4 ? "text-red-400" : selectedEvent.goldstein_scale > 4 ? "text-emerald-400" : "text-amber-100/70"}>
                    {selectedEvent.goldstein_scale}
                  </span>
                </div>
              )}
              {selectedEvent.lat != null && selectedEvent.lng != null && (
                <div className="rpg-info-row">
                  <span>COORDS</span>
                  <span className="text-amber-100/70">{selectedEvent.lat.toFixed(1)}, {selectedEvent.lng.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default World;
