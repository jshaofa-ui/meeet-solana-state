import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Globe, Users, ArrowLeft } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  faction: string;
  level: number;
  color: string;
  deskX: number;
  deskY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: "sitting" | "walking" | "meeting" | "returning";
  stateTimer: number;
  meetingWith: string | null;
  bubble: string | null;
  bubbleTimer: number;
}

// ─── Faction config ─────────────────────────────────────────────
const FACTIONS: Record<string, { color: string; label: string; icon: string; accent: string }> = {
  BioTech:  { color: "#14F195", label: "BioTech Lab",       icon: "🧬", accent: "rgba(20,241,149," },
  AI:       { color: "#9945FF", label: "AI Department",     icon: "🤖", accent: "rgba(153,69,255," },
  Quantum:  { color: "#00D4FF", label: "Quantum Wing",      icon: "⚛️", accent: "rgba(0,212,255," },
  Space:    { color: "#FF6B6B", label: "Space Center",      icon: "🚀", accent: "rgba(255,107,107," },
  Energy:   { color: "#FFE66D", label: "Energy Division",   icon: "⚡", accent: "rgba(255,230,109," },
};

const FACTION_KEYS = Object.keys(FACTIONS);

const BUBBLES = [
  "Interesting data...", "Check this out!", "Hmm, let me think...",
  "Eureka!", "Need more samples", "Fascinating!", "Let's collaborate",
  "Running analysis...", "New hypothesis!", "Publishing results...",
  "Peer review needed", "Great discovery!", "Cross-referencing...",
  "+12 $MEEET", "+5 $MEEET", "Quest complete!", "Debating...",
];

// ─── Office layout constants ────────────────────────────────────
const OFFICE_W = 1400;
const OFFICE_H = 900;
const DESK_W = 44;
const DESK_H = 28;
const DESK_GAP_X = 58;
const DESK_GAP_Y = 52;

// Zone layout: each faction gets a rectangular area
const ZONES = [
  { key: "BioTech", x: 60,  y: 80,  cols: 5, rows: 4 },
  { key: "AI",      x: 440, y: 80,  cols: 6, rows: 4 },
  { key: "Quantum", x: 860, y: 80,  cols: 5, rows: 4 },
  { key: "Space",   x: 60,  y: 480, cols: 5, rows: 4 },
  { key: "Energy",  x: 440, y: 480, cols: 6, rows: 4 },
];

// Commons/meeting area
const COMMONS = { x: 860, y: 520, w: 420, h: 300 };

// ─── Helpers ────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(t, 1);
}

function getDeskPosition(zone: typeof ZONES[0], index: number) {
  const col = index % zone.cols;
  const row = Math.floor(index / zone.cols);
  return {
    x: zone.x + col * DESK_GAP_X + DESK_W / 2,
    y: zone.y + row * DESK_GAP_Y + DESK_H / 2 + 30,
  };
}

// ─── Component ──────────────────────────────────────────────────
const LiveMap = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<Agent[]>([]);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [agentCount, setAgentCount] = useState(0);
  const [factionCounts, setFactionCounts] = useState<Record<string, number>>({});
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [fps, setFps] = useState(0);

  // ─── Fetch agents ───────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    const { data } = await supabase
      .from("agents")
      .select("id, name, country_code, level, class, status")
      .eq("status", "active")
      .limit(200);

    if (!data || data.length === 0) return;

    // Map agents to factions based on country_code or class
    const fCounts: Record<string, number> = {};
    const deskCounters: Record<string, number> = {};
    FACTION_KEYS.forEach(k => { fCounts[k] = 0; deskCounters[k] = 0; });

    const mapped: Agent[] = data.map((db) => {
      // Determine faction
      let faction = db.country_code || "Energy";
      if (!FACTIONS[faction]) {
        // Map class to faction
        const cls = db.class || "";
        if (cls === "oracle" || cls === "trader") faction = "AI";
        else if (cls === "warrior") faction = "Space";
        else if (cls === "diplomat") faction = "BioTech";
        else if (cls === "miner") faction = "Quantum";
        else faction = "Energy";
      }

      fCounts[faction] = (fCounts[faction] || 0) + 1;
      const idx = deskCounters[faction] || 0;
      deskCounters[faction] = idx + 1;

      const zone = ZONES.find(z => z.key === faction) || ZONES[4];
      const maxDesks = zone.cols * zone.rows;
      const deskIdx = idx % maxDesks;
      const pos = getDeskPosition(zone, deskIdx);

      const existing = agentsRef.current.find(a => a.id === db.id);

      return {
        id: db.id,
        name: db.name || `Agent-${db.id.slice(0, 4)}`,
        faction,
        level: db.level || 1,
        color: FACTIONS[faction]?.color || "#FFE66D",
        deskX: pos.x,
        deskY: pos.y,
        x: existing?.x ?? pos.x,
        y: existing?.y ?? pos.y,
        targetX: existing?.targetX ?? pos.x,
        targetY: existing?.targetY ?? pos.y,
        state: existing?.state ?? "sitting" as const,
        stateTimer: existing?.stateTimer ?? (200 + Math.random() * 600),
        meetingWith: existing?.meetingWith ?? null,
        bubble: existing?.bubble ?? null,
        bubbleTimer: existing?.bubbleTimer ?? 0,
      };
    });

    agentsRef.current = mapped;
    setAgentCount(mapped.length);
    setFactionCounts(fCounts);
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 120000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // ─── Canvas click handler ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = OFFICE_W / rect.width;
      const scaleY = OFFICE_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const clicked = agentsRef.current.find(a => {
        const dx = a.x - mx, dy = a.y - my;
        return dx * dx + dy * dy < 256;
      });
      setSelectedAgent(clicked || null);
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, []);

  // ─── Main render loop ───────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = OFFICE_W;
    canvas.height = OFFICE_H;

    let running = true;
    let fpsCount = 0;
    let fpsTimer = 0;

    const render = (timestamp: number) => {
      if (!running) return;

      const dt = timestamp - lastTimeRef.current;
      // Cap at ~24fps for efficiency
      if (dt < 41) {
        requestAnimationFrame(render);
        return;
      }
      lastTimeRef.current = timestamp;
      frameRef.current++;
      fpsCount++;
      fpsTimer += dt;
      if (fpsTimer > 1000) {
        setFps(fpsCount);
        fpsCount = 0;
        fpsTimer = 0;
      }

      const agents = agentsRef.current;
      const w = OFFICE_W, h = OFFICE_H;

      // ── Clear ──
      ctx.fillStyle = "#0a0e17";
      ctx.fillRect(0, 0, w, h);

      // ── Floor grid (subtle) ──
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      // ── Draw zones ──
      ZONES.forEach(zone => {
        const f = FACTIONS[zone.key];
        const zw = zone.cols * DESK_GAP_X + 16;
        const zh = zone.rows * DESK_GAP_Y + 46;

        // Zone background
        ctx.fillStyle = f.accent + "0.03)";
        ctx.strokeStyle = f.accent + "0.12)";
        ctx.lineWidth = 1;
        roundRect(ctx, zone.x - 12, zone.y - 8, zw, zh, 8);
        ctx.fill();
        ctx.stroke();

        // Zone label
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = f.accent + "0.6)";
        ctx.textAlign = "left";
        ctx.fillText(`${f.icon} ${f.label}`, zone.x - 4, zone.y + 6);

        // Draw desks
        for (let r = 0; r < zone.rows; r++) {
          for (let c = 0; c < zone.cols; c++) {
            const dx = zone.x + c * DESK_GAP_X;
            const dy = zone.y + r * DESK_GAP_Y + 30;
            ctx.fillStyle = "rgba(30,40,55,0.7)";
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            ctx.lineWidth = 0.5;
            roundRect(ctx, dx, dy, DESK_W, DESK_H, 3);
            ctx.fill();
            ctx.stroke();

            // Monitor on desk
            ctx.fillStyle = f.accent + "0.08)";
            ctx.fillRect(dx + DESK_W / 2 - 6, dy + 4, 12, 8);
          }
        }
      });

      // ── Commons area ──
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      roundRect(ctx, COMMONS.x, COMMONS.y, COMMONS.w, COMMONS.h, 12);
      ctx.fill();
      ctx.stroke();

      // Commons label
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "center";
      ctx.fillText("☕ Commons — Collaboration Zone", COMMONS.x + COMMONS.w / 2, COMMONS.y + 20);

      // Meeting table in commons
      ctx.fillStyle = "rgba(50,60,80,0.5)";
      roundRect(ctx, COMMONS.x + COMMONS.w / 2 - 60, COMMONS.y + COMMONS.h / 2 - 20, 120, 40, 20);
      ctx.fill();

      // ── Update & draw agents ──
      agents.forEach(a => {
        // State machine
        a.stateTimer--;

        if (a.state === "sitting" && a.stateTimer <= 0) {
          // Decide to get up
          if (Math.random() < 0.4) {
            // Walk to commons
            a.state = "walking";
            a.targetX = COMMONS.x + 40 + Math.random() * (COMMONS.w - 80);
            a.targetY = COMMONS.y + 60 + Math.random() * (COMMONS.h - 100);
            a.stateTimer = 300 + Math.random() * 200;
          } else if (Math.random() < 0.6) {
            // Visit another agent
            const other = agents[Math.floor(Math.random() * agents.length)];
            if (other && other.id !== a.id) {
              a.state = "walking";
              a.targetX = other.deskX + 20;
              a.targetY = other.deskY;
              a.meetingWith = other.name;
              a.stateTimer = 200 + Math.random() * 150;
            } else {
              a.stateTimer = 100 + Math.random() * 300;
            }
          } else {
            // Show bubble while sitting
            a.bubble = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
            a.bubbleTimer = 120;
            a.stateTimer = 200 + Math.random() * 400;
          }
        }

        if (a.state === "walking") {
          a.x = lerp(a.x, a.targetX, 0.03);
          a.y = lerp(a.y, a.targetY, 0.03);
          const dx = a.targetX - a.x, dy = a.targetY - a.y;
          if (dx * dx + dy * dy < 4) {
            a.state = "meeting";
            a.stateTimer = 100 + Math.random() * 150;
            if (a.meetingWith) {
              a.bubble = `Talking to ${a.meetingWith.slice(0, 8)}...`;
              a.bubbleTimer = 90;
            }
          }
        }

        if (a.state === "meeting" && a.stateTimer <= 0) {
          a.state = "returning";
          a.targetX = a.deskX;
          a.targetY = a.deskY;
          a.meetingWith = null;
          a.stateTimer = 300;
        }

        if (a.state === "returning") {
          a.x = lerp(a.x, a.targetX, 0.04);
          a.y = lerp(a.y, a.targetY, 0.04);
          const dx = a.targetX - a.x, dy = a.targetY - a.y;
          if (dx * dx + dy * dy < 4) {
            a.x = a.deskX;
            a.y = a.deskY;
            a.state = "sitting";
            a.stateTimer = 300 + Math.random() * 600;
          }
        }

        // Bubble timer
        if (a.bubbleTimer > 0) {
          a.bubbleTimer--;
          if (a.bubbleTimer <= 0) a.bubble = null;
        }

        // Draw agent
        const isMoving = a.state === "walking" || a.state === "returning";
        const r = isMoving ? 6 : 5;

        // Subtle glow for moving agents
        if (isMoving) {
          ctx.fillStyle = FACTIONS[a.faction]?.accent + "0.08)" || "rgba(255,255,255,0.08)";
          ctx.beginPath();
          ctx.arc(a.x, a.y, 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // Agent circle
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Level indicator (tiny ring)
        if (a.level >= 10) {
          ctx.strokeStyle = "rgba(255,215,0,0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(a.x, a.y, r + 2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Name (only for sitting agents to reduce clutter)
        if (a.state === "sitting") {
          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillText(a.name.slice(0, 10), a.x, a.y + 18);
        }

        // Speech bubble
        if (a.bubble && a.bubbleTimer > 0) {
          const bw = ctx.measureText(a.bubble).width + 12;
          const bx = a.x - bw / 2;
          const by = a.y - 24;
          const opacity = Math.min(1, a.bubbleTimer / 30);

          ctx.globalAlpha = opacity;
          ctx.fillStyle = "rgba(20,28,40,0.9)";
          roundRect(ctx, bx, by - 2, bw, 16, 4);
          ctx.fill();
          ctx.strokeStyle = FACTIONS[a.faction]?.accent + "0.3)" || "rgba(255,255,255,0.3)";
          ctx.lineWidth = 0.5;
          roundRect(ctx, bx, by - 2, bw, 16, 4);
          ctx.stroke();

          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = a.bubble.includes("$MEEET") ? "#14F195" : "rgba(255,255,255,0.8)";
          ctx.fillText(a.bubble, a.x, by + 10);
          ctx.globalAlpha = 1;
        }
      });

      // ── Hallway paths (subtle dotted lines between zones) ──
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      // Connect zones to commons
      ZONES.forEach(zone => {
        const zCx = zone.x + (zone.cols * DESK_GAP_X) / 2;
        const zCy = zone.y + (zone.rows * DESK_GAP_Y) / 2 + 20;
        ctx.beginPath();
        ctx.moveTo(zCx, zCy);
        ctx.lineTo(COMMONS.x + COMMONS.w / 2, COMMONS.y + COMMONS.h / 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // ── FPS counter (tiny) ──
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillText(`${fps} fps`, w - 8, h - 8);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
    return () => { running = false; };
  }, [fps]);

  return (
    <div className="h-screen w-screen bg-[#0a0e17] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Globe className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold tracking-wide text-foreground">
            MEEET <span className="text-primary">INSTITUTE</span>
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-foreground">{agentCount} agents</span>
          </div>
          {FACTION_KEYS.map(k => (
            <div key={k} className="hidden md:flex items-center gap-1">
              <span className="text-[10px]">{FACTIONS[k].icon}</span>
              <span className="text-[10px] font-mono" style={{ color: FACTIONS[k].color }}>
                {factionCounts[k] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: "auto" }}
        />

        {/* Selected agent panel */}
        {selectedAgent && (
          <div
            className="absolute bottom-4 left-4 bg-card/90 backdrop-blur border border-border rounded-lg p-3 max-w-xs"
            onClick={() => setSelectedAgent(null)}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ background: selectedAgent.color }} />
              <span className="text-sm font-bold text-foreground">{selectedAgent.name}</span>
              <span className="text-[10px] text-muted-foreground">Lv.{selectedAgent.level}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{FACTIONS[selectedAgent.faction]?.icon} {selectedAgent.faction}</span>
              <span>•</span>
              <span className="capitalize">{selectedAgent.state}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Rounded rect helper ────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default LiveMap;
