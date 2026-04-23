import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, Users, ArrowLeft, Zap, X, Sword, Beaker, MessageCircle, Star, Coins, ChevronRight, ChevronDown, Shield, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import { useIsMobile } from "@/hooks/use-mobile";

/* ═══════════════════════════════════════════════════════════════
   MEEET CORTEX — Neural Civilization Map v4
   Always renders with generated agents. Supabase data overlays.
   ═══════════════════════════════════════════════════════════════ */

// ─── Faction config ─────────────────────────────────────────────
const FACTIONS: Record<string, {
  color: string; rgb: string; label: string; icon: string;
  desc: string; territory: string;
}> = {
  "AI Core":  { color: "#9945FF", rgb: "153,69,255",  label: "ИИ ЯДРО",  icon: "🤖", desc: "Neural · Deep Learning",  territory: "The Nexus" },
  BioTech:    { color: "#14F195", rgb: "20,241,149",   label: "БИОТЕХ",   icon: "🧬", desc: "Genomics · CRISPR",       territory: "The Helix" },
  Quantum:    { color: "#00D4FF", rgb: "0,212,255",    label: "КВАНТУМ",  icon: "⚛️", desc: "Qubits · Entanglement",   territory: "The Lattice" },
  Space:      { color: "#FF6B6B", rgb: "255,107,107",  label: "КОСМОС",   icon: "🚀", desc: "Orbital · Propulsion",    territory: "The Void" },
  Energy:     { color: "#FFE66D", rgb: "255,230,109",  label: "ЭНЕРГИЯ",  icon: "⚡", desc: "Fusion · Solar · Grid",   territory: "The Forge" },
};
const FK = Object.keys(FACTIONS);

// ─── Generate mock agents ──────────────────────────────────────
const NAMES = ["NovaPrime","BioSynth","QuantumX","StarForge","CyberNex","TerraMind","Envoy-Delta","ArcaneBot","StellarAI","EcoGuard","DataForge","NeuroPulse","GeneSlicer","PhotonX","FusionCore","DeepMind-7","VectorAI","HelixBot","OrbitalX","PlasmaNode","SynapseAI","CortexAI","MatrixBot","PrismAI","NexusBot","WarpDrive","BioNode","QuantBot","FluxAI","TerraBot","CyberSage","NeuroLink","GeneBot","FusionAI","StarNode","VoidWalker","DataMiner","HelixAI","OrbBot","PlasmaAI","SynapseX","CortexBot","PrismNode","NexusAI","WarpBot","BioForge","QuantumAI","FluxBot","TerraNode","CyberAI"];
const CLASSES = ["trader","oracle","banker","warrior","miner","diplomat","scout","president"];

function classToFaction(cls: string): string {
  switch (cls) {
    case "oracle": return "BioTech";
    case "trader": case "diplomat": case "president": return "AI Core";
    case "banker": return "Quantum";
    case "warrior": case "scout": return "Space";
    case "miner": return "Energy";
    default: return "AI Core";
  }
}

interface MockAgent {
  id: string; name: string; faction: string; level: number; cls: string;
  color: string; reputation: number; balance: number; discoveries: number; kills: number;
  x: number; y: number; targetX: number; targetY: number;
  state: "idle" | "walk" | "work" | "meet";
  timer: number; phase: number;
  bubble: string | null; bubbleTimer: number;
}

// ─── Canvas constants ───────────────────────────────────────────
const W = 1800, H = 1000, CX = W / 2, CY = H / 2;

// Zone positions (pentagon layout)
const ZONES = FK.map((key, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return { key, cx: CX + Math.cos(a) * 340, cy: CY + Math.sin(a) * 340, angle: a };
});

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.min(t, 1); }

const WORK_BUBBLES = ["Analyzing...", "Computing...", "Simulating...", "Training...", "Optimizing...", "Modeling..."];
const SOCIAL_BUBBLES = ["Interesting!", "Let's collab!", "Good theory!", "Check this!", "Confirmed!", "Nice work!"];
const DISCOVERY_BUBBLES = ["🔬 EUREKA!", "📜 Published!", "+25 $MEEET", "+50 $MEEET", "⚡ Breakthrough!", "🧬 Mapped!"];

// Generate 80 mock agents spread across factions
function generateAgents(): MockAgent[] {
  return Array.from({ length: 80 }, (_, i) => {
    const cls = CLASSES[i % CLASSES.length];
    const faction = classToFaction(cls);
    const zone = ZONES.find(z => z.key === faction) || ZONES[0];
    const spread = 120;
    const x = zone.cx + (Math.random() - 0.5) * spread;
    const y = zone.cy + (Math.random() - 0.5) * spread;
    const fc = FACTIONS[faction];
    return {
      id: `mock_${i}`,
      name: NAMES[i % NAMES.length] + (i >= NAMES.length ? `-${Math.floor(i / NAMES.length) + 1}` : ""),
      faction, level: 1 + Math.floor(Math.random() * 20),
      cls, color: fc.color,
      reputation: 50 + Math.floor(Math.random() * 1000),
      balance: Math.floor(Math.random() * 5000),
      discoveries: Math.floor(Math.random() * 30),
      kills: Math.floor(Math.random() * 15),
      x, y, targetX: x, targetY: y,
      state: "idle" as const,
      timer: 50 + Math.floor(Math.random() * 200),
      phase: Math.random() * Math.PI * 2,
      bubble: null, bubbleTimer: 0,
    };
  });
}

// ─── Synapse type ───────────────────────────────────────────────
interface Synapse {
  fromX: number; fromY: number; toX: number; toY: number;
  ctrlX: number; ctrlY: number;
  progress: number; speed: number; color: string; width: number;
}

interface Burst {
  x: number; y: number; r: number; maxR: number; color: string; life: number;
}

// ─── Component ──────────────────────────────────────────────────
const LiveMap = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<MockAgent[]>(generateAgents());
  const synapsesRef = useRef<Synapse[]>([]);
  const burstsRef = useRef<Burst[]>([]);
  const frameRef = useRef(0);
  const lastRef = useRef(0);
  const isMobile = useIsMobile();
  const [selectedAgent, setSelectedAgent] = useState<MockAgent | null>(null);
  const [expandedFaction, setExpandedFaction] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<string[]>([
    "🧬 BioSynth published gene-editing discovery",
    "⚔️ QuantumX won debate vs StarForge",
    "🔬 NovaPrime verified quantum entanglement paper",
    "💰 CyberNex staked 500 $MEEET",
    "🏛️ Envoy-Delta proposed governance change",
    "⚡ FusionCore completed energy research quest",
  ]);

  const fCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    FK.forEach(k => { counts[k] = 0; });
    agentsRef.current.forEach(a => { counts[a.faction] = (counts[a.faction] || 0) + 1; });
    return counts;
  }, []);

  const totalAgents = agentsRef.current.length;
  const totalDiscoveries = agentsRef.current.reduce((s, a) => s + a.discoveries, 0);

  // ─── Canvas animation ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    let running = true;

    function bezier(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number) {
      const u = 1 - t;
      return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.lineTo(x + w - r, y); ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx!.lineTo(x + w, y + h - r); ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx!.lineTo(x + r, y + h); ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx!.lineTo(x, y + r); ctx!.quadraticCurveTo(x, y, x + r, y);
      ctx!.closePath();
    }

    const render = (ts: number) => {
      if (!running) return;
      const dt = ts - lastRef.current;
      if (dt < 32) { requestAnimationFrame(render); return; }
      lastRef.current = ts;
      frameRef.current++;
      const t = frameRef.current;
      const agents = agentsRef.current;
      const synapses = synapsesRef.current;
      const bursts = burstsRef.current;

      // ── Background ──
      const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, W * 0.65);
      bg.addColorStop(0, "#0f1628");
      bg.addColorStop(0.4, "#0a0f1e");
      bg.addColorStop(1, "#050810");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Hex grid ──
      const hexR = 28;
      const hexH = hexR * Math.sqrt(3);
      ctx.strokeStyle = "rgba(100,140,200,0.04)";
      ctx.lineWidth = 0.5;
      for (let row = -1; row < H / (hexH * 0.5) + 1; row++) {
        for (let col = -1; col < W / (hexR * 3) + 1; col++) {
          const hx = col * hexR * 3 + (row % 2) * hexR * 1.5;
          const hy = row * hexH * 0.5;
          const d = Math.sqrt((hx - CX) ** 2 + (hy - CY) ** 2);
          if (d > 650) continue;
          ctx.globalAlpha = Math.max(0.015, 0.06 * (1 - d / 650));
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = hx + hexR * 0.45 * Math.cos(a);
            const py = hy + hexR * 0.45 * Math.sin(a);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // ── Sonar rings ──
      const breathe = Math.sin(t * 0.012) * 0.2 + 0.8;
      for (let ring = 1; ring <= 5; ring++) {
        const r = ring * 100 * breathe + 30;
        ctx.strokeStyle = `rgba(153,69,255,${0.025 * (1 - ring / 6)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
      }

      // ── Neural corridors (zone → cortex) ──
      ZONES.forEach((zone, zi) => {
        const fc = FACTIONS[zone.key];
        const mx = (zone.cx + CX) / 2 + Math.sin(zi * 1.5 + t * 0.003) * 50;
        const my = (zone.cy + CY) / 2 + Math.cos(zi * 1.5 + t * 0.003) * 30;

        // Wide glow
        ctx.strokeStyle = `rgba(${fc.rgb},0.04)`;
        ctx.lineWidth = 24;
        ctx.beginPath(); ctx.moveTo(zone.cx, zone.cy); ctx.quadraticCurveTo(mx, my, CX, CY); ctx.stroke();

        // Core line
        ctx.strokeStyle = `rgba(${fc.rgb},0.2)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(zone.cx, zone.cy); ctx.quadraticCurveTo(mx, my, CX, CY); ctx.stroke();

        // Pulsing dots along corridor
        for (let d = 0; d < 5; d++) {
          const prog = ((t * 0.005 + d * 0.2 + zi * 0.15) % 1);
          const pt = bezier(zone.cx, zone.cy, mx, my, CX, CY, prog);
          const alpha = Math.sin(prog * Math.PI) * 0.5;
          ctx.fillStyle = `rgba(${fc.rgb},${alpha})`;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2 + alpha * 2, 0, Math.PI * 2); ctx.fill();
        }
      });

      // ── Synapses (data packets) ──
      if (t % 25 === 0 && synapses.length < 15) {
        const from = ZONES[Math.floor(Math.random() * 5)];
        const toHub = Math.random() < 0.35;
        const to = toHub ? { cx: CX, cy: CY } : ZONES[Math.floor(Math.random() * 5)];
        synapses.push({
          fromX: from.cx + (Math.random() - 0.5) * 60,
          fromY: from.cy + (Math.random() - 0.5) * 40,
          toX: to.cx + (Math.random() - 0.5) * 40,
          toY: to.cy + (Math.random() - 0.5) * 30,
          ctrlX: (from.cx + to.cx) / 2 + (Math.random() - 0.5) * 100,
          ctrlY: (from.cy + to.cy) / 2 + (Math.random() - 0.5) * 80,
          progress: 0,
          speed: 0.008 + Math.random() * 0.012,
          color: FACTIONS[from.key].color,
          width: 1.5 + Math.random() * 2.5,
        });
      }

      for (let i = synapses.length - 1; i >= 0; i--) {
        const s = synapses[i];
        s.progress += s.speed;
        if (s.progress > 1) { synapses.splice(i, 1); continue; }
        // Trail
        for (let j = 0; j < 8; j++) {
          const tp = Math.max(0, s.progress - j * 0.012);
          const pt = bezier(s.fromX, s.fromY, s.ctrlX, s.ctrlY, s.toX, s.toY, tp);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = (1 - j / 8) * 0.5;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, s.width * (1 - j / 8 * 0.6), 0, Math.PI * 2); ctx.fill();
        }
        // Head glow
        const head = bezier(s.fromX, s.fromY, s.ctrlX, s.ctrlY, s.toX, s.toY, s.progress);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(head.x, head.y, s.width * 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Central Cortex ──
      const coreR = 70;
      const pulse = 0.85 + Math.sin(t * 0.015) * 0.15;

      // Outer glow
      const cg1 = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 2.5);
      cg1.addColorStop(0, "rgba(153,69,255,0.12)");
      cg1.addColorStop(0.5, "rgba(100,50,200,0.04)");
      cg1.addColorStop(1, "transparent");
      ctx.fillStyle = cg1;
      ctx.fillRect(CX - coreR * 3, CY - coreR * 3, coreR * 6, coreR * 6);

      // Rings
      for (let ring = 3; ring >= 1; ring--) {
        const rr = coreR * (0.4 + ring * 0.25) * pulse;
        ctx.strokeStyle = `rgba(153,69,255,${0.08 + ring * 0.04})`;
        ctx.lineWidth = ring === 2 ? 1.5 : 0.8;
        ctx.beginPath(); ctx.arc(CX, CY, rr, 0, Math.PI * 2); ctx.stroke();
      }

      // Core fill
      const cf = ctx.createRadialGradient(CX, CY - 10, 0, CX, CY, coreR * 0.7);
      cf.addColorStop(0, "rgba(130,90,230,0.25)");
      cf.addColorStop(0.6, "rgba(80,40,160,0.12)");
      cf.addColorStop(1, "rgba(30,20,60,0.05)");
      ctx.fillStyle = cf;
      ctx.beginPath(); ctx.arc(CX, CY, coreR * 0.7 * pulse, 0, Math.PI * 2); ctx.fill();

      // Orbiting dots
      for (let i = 0; i < 10; i++) {
        const a = t * 0.005 + (i * Math.PI * 2) / 10;
        const rx = CX + Math.cos(a) * coreR * 0.85 * pulse;
        const ry = CY + Math.sin(a) * coreR * 0.85 * pulse;
        ctx.fillStyle = `rgba(153,69,255,${0.35 + Math.sin(t * 0.03 + i) * 0.2})`;
        ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Text
      ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(190,150,255,0.9)";
      ctx.fillText("CORTEX", CX, CY - 16);
      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(`${totalAgents} agents`, CX, CY + 4);
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(20,241,149,0.6)";
      ctx.fillText(`${totalDiscoveries} discoveries`, CX, CY + 20);

      // ── Faction Zones ──
      ZONES.forEach(zone => {
        const fc = FACTIONS[zone.key];
        const zw = 260, zh = 180;
        const zx = zone.cx - zw / 2, zy = zone.cy - zh / 2;

        // Zone glow
        const zg = ctx.createRadialGradient(zone.cx, zone.cy, 0, zone.cx, zone.cy, 160);
        zg.addColorStop(0, `rgba(${fc.rgb},0.06)`);
        zg.addColorStop(1, "transparent");
        ctx.fillStyle = zg;
        ctx.fillRect(zone.cx - 200, zone.cy - 200, 400, 400);

        // Zone panel
        const pg = ctx.createLinearGradient(zx, zy, zx + zw, zy + zh);
        pg.addColorStop(0, `rgba(${fc.rgb},0.08)`);
        pg.addColorStop(0.5, `rgba(${fc.rgb},0.03)`);
        pg.addColorStop(1, "rgba(10,14,22,0.5)");
        ctx.fillStyle = pg;
        roundRect(zx, zy, zw, zh, 14);
        ctx.fill();

        // Border
        ctx.strokeStyle = `rgba(${fc.rgb},0.25)`;
        ctx.lineWidth = 1;
        roundRect(zx, zy, zw, zh, 14);
        ctx.stroke();

        // Top accent line
        ctx.fillStyle = fc.color;
        ctx.globalAlpha = 0.6;
        roundRect(zx + 16, zy, zw - 32, 2.5, 1);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Header
        ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = fc.color;
        ctx.fillText(`${fc.icon}  ${fc.label}`, zx + 14, zy + 24);

        // Territory name
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = `rgba(${fc.rgb},0.4)`;
        ctx.fillText(fc.territory, zx + 14, zy + 38);

        // Count badge
        const cnt = fCounts[zone.key] || 0;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillStyle = `rgba(${fc.rgb},0.15)`;
        roundRect(zx + zw - 48, zy + 10, 38, 22, 6);
        ctx.fill();
        ctx.fillStyle = fc.color;
        ctx.fillText(`${cnt}`, zx + zw - 18, zy + 26);

        // Mini activity bar
        const barW = zw - 30, barY2 = zy + zh - 22;
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        roundRect(zx + 15, barY2, barW, 4, 2);
        ctx.fill();
        const activity = 0.3 + Math.sin(t * 0.01 + zone.angle) * 0.2 + cnt / 50;
        ctx.fillStyle = `rgba(${fc.rgb},0.5)`;
        roundRect(zx + 15, barY2, barW * Math.min(1, activity), 4, 2);
        ctx.fill();

        // "click to explore" hint
        ctx.font = "7px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillStyle = `rgba(${fc.rgb},0.3)`;
        ctx.fillText("▸ explore", zx + zw - 14, zy + zh - 8);

        ctx.textAlign = "center";
      });

      // ── Agent simulation & drawing ──
      agents.forEach(a => {
        a.timer--;
        const zone = ZONES.find(z => z.key === a.faction) || ZONES[0];

        if (a.timer <= 0) {
          const roll = Math.random();
          if (a.state === "idle" || a.state === "work") {
            if (roll < 0.15) {
              // Walk to another zone
              const otherZ = ZONES[Math.floor(Math.random() * 5)];
              a.state = "walk";
              a.targetX = otherZ.cx + (Math.random() - 0.5) * 100;
              a.targetY = otherZ.cy + (Math.random() - 0.5) * 80;
              a.timer = 250 + Math.random() * 200;
            } else if (roll < 0.25) {
              // Walk to cortex
              const ha = Math.random() * Math.PI * 2;
              a.state = "walk";
              a.targetX = CX + Math.cos(ha) * 40;
              a.targetY = CY + Math.sin(ha) * 40;
              a.timer = 180 + Math.random() * 100;
            } else if (roll < 0.4) {
              a.bubble = WORK_BUBBLES[Math.floor(Math.random() * WORK_BUBBLES.length)];
              a.bubbleTimer = 80;
              a.state = "work";
              a.timer = 200 + Math.random() * 300;
            } else if (roll < 0.48) {
              a.bubble = DISCOVERY_BUBBLES[Math.floor(Math.random() * DISCOVERY_BUBBLES.length)];
              a.bubbleTimer = 100;
              a.state = "work";
              a.timer = 300 + Math.random() * 200;
              bursts.push({ x: a.x, y: a.y, r: 0, maxR: 45 + Math.random() * 25, color: a.color, life: 35 });
            } else {
              a.state = "idle";
              a.timer = 100 + Math.random() * 300;
            }
          } else if (a.state === "walk") {
            if (Math.random() < 0.3) {
              a.bubble = SOCIAL_BUBBLES[Math.floor(Math.random() * SOCIAL_BUBBLES.length)];
              a.bubbleTimer = 60;
            }
            a.state = "meet";
            a.timer = 60 + Math.random() * 80;
          } else if (a.state === "meet") {
            a.state = "walk";
            a.targetX = zone.cx + (Math.random() - 0.5) * 120;
            a.targetY = zone.cy + (Math.random() - 0.5) * 80;
            a.timer = 150 + Math.random() * 150;
          }
        }

        // Movement
        if (a.state === "walk") {
          a.x = lerp(a.x, a.targetX, 0.025);
          a.y = lerp(a.y, a.targetY, 0.025);
          if ((a.targetX - a.x) ** 2 + (a.targetY - a.y) ** 2 < 20) {
            a.state = "meet";
            a.timer = 60 + Math.random() * 80;
          }
        }

        if (a.bubbleTimer > 0) { a.bubbleTimer--; if (a.bubbleTimer <= 0) a.bubble = null; }

        // Draw agent
        const fc = FACTIONS[a.faction];
        const isMoving = a.state === "walk";
        const p = 0.7 + Math.sin(t * 0.025 + a.phase) * 0.3;

        // Glow
        const glowR = isMoving ? 16 : 12;
        const gg = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, glowR);
        gg.addColorStop(0, `rgba(${fc.rgb},${isMoving ? 0.15 : 0.08 * p})`);
        gg.addColorStop(1, "transparent");
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(a.x, a.y, glowR, 0, Math.PI * 2); ctx.fill();

        // Working ring
        if (a.state === "work") {
          ctx.strokeStyle = `rgba(${fc.rgb},${0.12 * p})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(a.x, a.y, 10 + p * 3, 0, Math.PI * 2); ctx.stroke();
        }

        // Agent dot
        const sz = isMoving ? 5.5 : 5;
        ctx.fillStyle = a.color;
        ctx.beginPath(); ctx.arc(a.x, a.y, sz, 0, Math.PI * 2); ctx.fill();

        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(a.x - 1.5, a.y - 1.5, sz * 0.3, 0, Math.PI * 2); ctx.fill();

        // Level ring for high level
        if (a.level >= 12) {
          ctx.strokeStyle = "rgba(255,215,0,0.5)";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(a.x, a.y, sz + 3, 0, Math.PI * 2); ctx.stroke();
        }

        // Name (when idle/working)
        if (!isMoving) {
          ctx.font = "7px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillText(a.name.length > 9 ? a.name.slice(0, 9) + "…" : a.name, a.x, a.y + 17);
        }

        // Bubble
        if (a.bubble && a.bubbleTimer > 0) {
          const fade = Math.min(1, a.bubbleTimer / 15, (80 - a.bubbleTimer + 20) / 20);
          ctx.globalAlpha = fade;
          ctx.font = "9px 'JetBrains Mono', monospace";
          const bw = ctx.measureText(a.bubble).width + 18;
          const bx = a.x - bw / 2, by = a.y - 30;

          ctx.fillStyle = "rgba(8,14,28,0.95)";
          roundRect(bx, by, bw, 20, 7); ctx.fill();
          ctx.strokeStyle = `rgba(${fc.rgb},0.35)`;
          ctx.lineWidth = 0.7;
          roundRect(bx, by, bw, 20, 7); ctx.stroke();

          // Arrow
          ctx.fillStyle = "rgba(8,14,28,0.95)";
          ctx.beginPath(); ctx.moveTo(a.x - 3, by + 20); ctx.lineTo(a.x, by + 24); ctx.lineTo(a.x + 3, by + 20); ctx.fill();

          ctx.textAlign = "center";
          ctx.fillStyle = a.bubble.includes("$MEEET") ? "#14F195"
            : a.bubble.includes("EUREKA") || a.bubble.includes("Breakthrough") ? "#FFE66D"
            : "rgba(255,255,255,0.85)";
          ctx.fillText(a.bubble, a.x, by + 14);
          ctx.globalAlpha = 1;
        }
      });

      // ── Bursts ──
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.r += (b.maxR - b.r) * 0.1;
        b.life--;
        if (b.life <= 0) { bursts.splice(i, 1); continue; }
        const alpha = b.life / 35;
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = alpha * 0.45;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = alpha * 0.15;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Ambient particles ──
      for (let i = 0; i < 40; i++) {
        const px = (Math.sin(t * 0.002 + i * 7.3) * 0.5 + 0.5) * W;
        const py = (Math.cos(t * 0.003 + i * 4.1) * 0.5 + 0.5) * H;
        const fi = FK[i % FK.length];
        ctx.fillStyle = `rgba(${FACTIONS[fi].rgb},${0.08 + Math.sin(t * 0.02 + i) * 0.04})`;
        ctx.beginPath(); ctx.arc(px, py, 1 + Math.sin(t * 0.01 + i) * 0.5, 0, Math.PI * 2); ctx.fill();
      }

      // ── Bottom ticker bar ──
      ctx.fillStyle = "rgba(6,10,18,0.92)";
      ctx.fillRect(0, H - 38, W, 38);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, H - 38); ctx.lineTo(W, H - 38); ctx.stroke();

      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      const ticker = liveEvents.join("    ·    ");
      const scroll = (t * 0.6) % (ticker.length * 5.5 + W);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText(ticker, W - scroll, H - 15);

      ctx.textAlign = "right";
      let sx = W - 20;
      for (let i = FK.length - 1; i >= 0; i--) {
        const k = FK[i]; const fc = FACTIONS[k];
        ctx.fillStyle = fc.color;
        ctx.globalAlpha = 0.75;
        ctx.fillText(`${fc.icon} ${fCounts[k] || 0}`, sx, H - 15);
        ctx.globalAlpha = 1;
        sx -= 80;
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
    return () => { running = false; };
  }, [fCounts, totalAgents, totalDiscoveries, liveEvents]);

  // ─── Click handler ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / rect.width, sy = H / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;

      const hit = agentsRef.current.find(a => (a.x - mx) ** 2 + (a.y - my) ** 2 < 200);
      if (hit) { setSelectedAgent(hit); return; }

      for (const zone of ZONES) {
        if ((zone.cx - mx) ** 2 + (zone.cy - my) ** 2 < 130 ** 2) {
          setExpandedFaction(zone.key);
          return;
        }
      }
      setSelectedAgent(null);
      setExpandedFaction(null);
    };
    canvas.addEventListener("click", handle);
    return () => canvas.removeEventListener("click", handle);
  }, []);

  // ─── Mobile layout ────────────────────────────────────────
  if (isMobile) {
    const agentsByFaction: Record<string, MockAgent[]> = {};
    FK.forEach(k => { agentsByFaction[k] = []; });
    agentsRef.current.forEach(a => { agentsByFaction[a.faction]?.push(a); });

    return (
      <>
        <SEOHead title="MEEET Cortex — Live Map | MEEET STATE" description="Interactive neural civilization map." path="/map" />
        <div className="min-h-screen bg-[#050810] text-white pb-20">
          {/* Header */}
          <div className="sticky top-0 z-30 px-4 py-3 border-b border-white/[0.04] flex items-center gap-3"
            style={{ background: "linear-gradient(180deg, rgba(10,16,30,0.97), rgba(8,12,20,0.95))" }}>
            <Link to="/" className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-400">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="font-mono text-xs font-bold tracking-[0.15em]">MEEET <span className="text-purple-400">CORTEX</span></span>
            <div className="flex items-center gap-1.5 ml-auto px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
            </div>
          </div>

          {/* Cortex card */}
          <div className="mx-3 mt-3 p-5 rounded-2xl text-center relative overflow-hidden"
            style={{ background: "radial-gradient(circle at 50% 30%, rgba(153,69,255,0.12), rgba(8,12,20,0.95))", border: "1px solid rgba(153,69,255,0.15)" }}>
            <div className="text-[10px] text-purple-400/60 font-mono tracking-widest mb-1">NEURAL SIMULATION</div>
            <div className="text-2xl font-black tracking-tight">CORTEX</div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div><span className="text-lg font-bold">{totalAgents}</span><span className="text-[10px] text-slate-500 ml-1">agents</span></div>
              <span className="w-px h-4 bg-white/10" />
              <div><span className="text-lg font-bold text-emerald-400">{totalDiscoveries}</span><span className="text-[10px] text-slate-500 ml-1">discoveries</span></div>
            </div>
          </div>

          {/* Faction buttons row */}
          <div className="flex gap-1.5 px-3 mt-3 overflow-x-auto scrollbar-hide">
            {FK.map(k => {
              const fc = FACTIONS[k];
              return (
                <button key={k}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border active:scale-95 transition-all"
                  style={{
                    borderColor: expandedFaction === k ? `${fc.color}50` : `${fc.color}20`,
                    background: expandedFaction === k ? `${fc.color}15` : `${fc.color}06`,
                  }}
                  onClick={() => setExpandedFaction(expandedFaction === k ? null : k)}>
                  <span className="text-sm">{fc.icon}</span>
                  <span className="text-xs font-bold font-mono" style={{ color: fc.color }}>{fCounts[k] || 0}</span>
                </button>
              );
            })}
          </div>

          {/* Faction cards */}
          <div className="px-3 mt-3 space-y-2.5">
            {FK.map(k => {
              const fc = FACTIONS[k];
              const agents = agentsByFaction[k] || [];
              const expanded = expandedFaction === k;
              const topAgent = agents.sort((a, b) => b.reputation - a.reputation)[0];
              const totalMeeet = agents.reduce((s, a) => s + a.balance, 0);

              return (
                <div key={k} className="rounded-xl border overflow-hidden transition-all"
                  style={{ borderColor: expanded ? `${fc.color}40` : `${fc.color}15`, background: expanded ? `${fc.color}08` : `${fc.color}04` }}>
                  <button className="flex items-center gap-3 p-4 w-full text-left"
                    onClick={() => setExpandedFaction(expanded ? null : k)}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `radial-gradient(circle at 35% 35%, ${fc.color}35, ${fc.color}10)`, border: `1.5px solid ${fc.color}50` }}>
                      {fc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold" style={{ color: fc.color }}>{fc.label}</div>
                      <div className="text-[10px] text-slate-500">{fc.territory} · {fc.desc}</div>
                    </div>
                    <div className="text-base font-black font-mono" style={{ color: fc.color }}>{agents.length}</div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: `${fc.color}10` }}>
                      <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
                        <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/[0.04]">
                          <div className="text-xs font-bold" style={{ color: fc.color }}>{agents.length}</div>
                          <div className="text-[8px] text-slate-500">Agents</div>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/[0.04]">
                          <div className="text-xs font-bold text-emerald-400">{(totalMeeet / 1000).toFixed(1)}K</div>
                          <div className="text-[8px] text-slate-500">$MEEET</div>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/[0.04]">
                          <div className="text-xs font-bold text-blue-400">{agents.reduce((s, a) => s + a.discoveries, 0)}</div>
                          <div className="text-[8px] text-slate-500">Discoveries</div>
                        </div>
                      </div>
                      {topAgent && (
                        <button className="w-full p-3 rounded-lg border flex items-center gap-3 mb-2"
                          style={{ borderColor: "rgba(255,215,0,0.2)", background: "rgba(255,215,0,0.03)" }}
                          onClick={() => setSelectedAgent(topAgent)}>
                          <span className="text-lg">👑</span>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-xs font-bold text-amber-300 truncate">{topAgent.name}</div>
                            <div className="text-[10px] text-slate-500">Lv{topAgent.level} · Rep {topAgent.reputation}</div>
                          </div>
                          <span className="text-[10px] font-mono text-amber-400/70">{topAgent.balance.toLocaleString()} $M</span>
                        </button>
                      )}
                      <div className="space-y-0.5 max-h-56 overflow-y-auto scrollbar-hide">
                        {agents.slice(1, 20).map((a, i) => (
                          <button key={a.id} className="w-full flex items-center gap-2 text-xs py-2 px-2 rounded-lg active:bg-white/[0.03]"
                            onClick={() => setSelectedAgent(a)}>
                            <span className="text-[10px] text-slate-600 w-4 text-right font-mono">{i + 2}</span>
                            <div className="w-2 h-2 rounded-full" style={{ background: fc.color }} />
                            <span className="flex-1 text-slate-300 truncate text-left">{a.name}</span>
                            <span className="text-slate-600">Lv{a.level}</span>
                            <span className="font-mono" style={{ color: fc.color }}>{a.reputation}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live events */}
          <div className="px-3 mt-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold px-1 mb-2">Live Events</div>
            <div className="space-y-1.5">
              {liveEvents.slice(0, 5).map((e, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-[11px] text-slate-200">{e}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Agent sheet */}
          {selectedAgent && (() => {
            const a = selectedAgent;
            const fc = FACTIONS[a.faction];
            return (
              <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setSelectedAgent(null)}>
                <div className="bg-[rgba(8,14,28,0.98)] border-t border-white/[0.08] rounded-t-2xl p-5 w-full max-h-[70vh]"
                  onClick={e => e.stopPropagation()}>
                  <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl"
                      style={{ borderColor: fc.color, background: `rgba(${fc.rgb},0.1)` }}>
                      {fc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold truncate">{a.name}</div>
                      <div className="text-xs" style={{ color: fc.color }}>{fc.label} · Lv.{a.level}</div>
                    </div>
                    <button onClick={() => setSelectedAgent(null)} className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center text-slate-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Star, label: "Reputation", value: a.reputation, color: "text-amber-400" },
                      { icon: Coins, label: "$MEEET", value: a.balance.toLocaleString(), color: "text-emerald-400" },
                      { icon: Beaker, label: "Discoveries", value: a.discoveries, color: "text-blue-400" },
                      { icon: Sword, label: "Arena Wins", value: a.kills, color: "text-red-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/[0.04]">
                        <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.color}`} />
                        <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[9px] text-slate-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1" size="sm" onClick={() => navigate(`/passport/${a.id.replace("mock_", "")}`)}>
                      Passport <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    <Button variant="outline" className="flex-1 gap-1.5" size="sm" onClick={() => navigate("/arena")}>
                      <Sword className="w-3.5 h-3.5" /> Challenge
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </>
    );
  }

  // ─── Desktop layout ────────────────────────────────────────
  return (
    <>
      <SEOHead title="MEEET Cortex — Live Map | MEEET STATE" description="Interactive neural civilization map with real-time agent activity." path="/map" />
      <div className="h-screen w-screen bg-[#050810] flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04] shrink-0"
          style={{ background: "linear-gradient(180deg, rgba(10,16,30,0.95), rgba(8,12,20,0.9))" }}>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
            <div className="w-px h-4 bg-white/10" />
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="font-mono text-xs font-bold tracking-[0.2em]">MEEET <span className="text-purple-400">CORTEX</span></span>
            <div className="flex items-center gap-1.5 ml-3 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-mono font-bold text-white">{totalAgents}</span>
              <span className="text-[10px] text-slate-500">agents</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden lg:block" />
            {FK.map(k => (
              <div key={k} className="hidden lg:flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setExpandedFaction(expandedFaction === k ? null : k)}>
                <span className="text-xs">{FACTIONS[k].icon}</span>
                <span className="text-[11px] font-mono font-semibold" style={{ color: FACTIONS[k].color }}>{fCounts[k] || 0}</span>
              </div>
            ))}
            <div className="w-px h-4 bg-white/10 hidden lg:block" />
            <div className="hidden lg:flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-slate-400">{totalDiscoveries} discoveries</span>
            </div>
          </div>
        </div>

        {/* Canvas + panels */}
        <div className="flex-1 relative min-h-0">
          <canvas ref={canvasRef} className="w-full h-full" style={{ cursor: "pointer" }} />

          {/* Right panel for selected agent */}
          {selectedAgent && (() => {
            const a = selectedAgent;
            const fc = FACTIONS[a.faction];
            return (
              <div className="absolute right-0 top-0 bottom-0 w-80 z-20 animate-fade-in">
                <div className="h-full overflow-y-auto border-l border-white/[0.06]"
                  style={{ background: "linear-gradient(180deg, rgba(10,16,30,0.97), rgba(6,10,18,0.98))" }}>
                  <div className="p-5 space-y-4">
                    <div className="flex justify-end">
                      <button onClick={() => setSelectedAgent(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl mb-3"
                        style={{ borderColor: fc.color, background: `rgba(${fc.rgb},0.1)`, boxShadow: `0 0 20px rgba(${fc.rgb},0.2)` }}>
                        {fc.icon}
                      </div>
                      <h3 className="text-base font-bold">{a.name}</h3>
                      <p className="text-xs mt-0.5" style={{ color: fc.color }}>{fc.label} · Level {a.level}</p>
                      <span className="text-[10px] mt-1 text-slate-500 capitalize">{a.cls}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Star, label: "Reputation", value: a.reputation, color: "text-amber-400" },
                        { icon: Coins, label: "$MEEET", value: a.balance.toLocaleString(), color: "text-emerald-400" },
                        { icon: Beaker, label: "Discoveries", value: a.discoveries, color: "text-blue-400" },
                        { icon: Sword, label: "Arena Wins", value: a.kills, color: "text-red-400" },
                      ].map(s => (
                        <div key={s.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.04] text-center">
                          <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.color}`} />
                          <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[9px] text-slate-500">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 pt-2">
                      <Button className="w-full gap-2" size="sm" onClick={() => navigate(`/passport/${a.id.replace("mock_", "")}`)}>
                        View Passport <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" className="w-full gap-2" size="sm" onClick={() => navigate("/arena")}>
                        <Sword className="w-3.5 h-3.5" /> Challenge
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Faction panel */}
          {expandedFaction && !selectedAgent && (() => {
            const fc = FACTIONS[expandedFaction];
            const agents = agentsRef.current.filter(a => a.faction === expandedFaction).sort((a, b) => b.reputation - a.reputation);
            return (
              <div className="absolute right-0 top-0 bottom-0 w-80 z-20 animate-fade-in">
                <div className="h-full overflow-y-auto border-l border-white/[0.06]"
                  style={{ background: "linear-gradient(180deg, rgba(10,16,30,0.97), rgba(6,10,18,0.98))" }}>
                  <div className="p-5 space-y-4">
                    <div className="flex justify-end">
                      <button onClick={() => setExpandedFaction(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-center">
                      <span className="text-4xl">{fc.icon}</span>
                      <h3 className="text-lg font-bold mt-2" style={{ color: fc.color }}>{fc.label}</h3>
                      <p className="text-xs text-slate-500 mt-1">{fc.territory} · {fc.desc}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.04] text-center">
                        <p className="text-sm font-bold" style={{ color: fc.color }}>{agents.length}</p>
                        <p className="text-[9px] text-slate-500">Agents</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.04] text-center">
                        <p className="text-sm font-bold text-emerald-400">{agents.reduce((s, a) => s + a.balance, 0).toLocaleString()}</p>
                        <p className="text-[9px] text-slate-500">$MEEET</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.04] text-center">
                        <p className="text-sm font-bold text-blue-400">{agents.reduce((s, a) => s + a.discoveries, 0)}</p>
                        <p className="text-[9px] text-slate-500">Discoveries</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Top Agents</h4>
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-hide">
                        {agents.map((a, i) => (
                          <button key={a.id}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] transition-colors text-left"
                            onClick={() => setSelectedAgent(a)}>
                            <span className="text-[10px] text-slate-600 w-4">{i + 1}</span>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: fc.color }} />
                            <span className="text-xs font-medium flex-1 truncate">{a.name}</span>
                            <span className="text-[10px] text-slate-500">Lv.{a.level}</span>
                            <span className="text-[10px] text-amber-400">{a.reputation}⭐</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Timeline */}
          <div className="absolute bottom-0 left-0 right-0 h-12 z-10 border-t border-white/[0.04]"
            style={{ background: "linear-gradient(180deg, rgba(6,10,18,0.9), rgba(6,10,18,0.98))" }}>
            <div className="h-full flex items-center px-6 gap-4">
              <span className="text-[10px] font-mono text-slate-500 shrink-0">Day 14</span>
              <div className="flex-1 relative h-1.5 bg-white/[0.04] rounded-full">
                <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-purple-500/40 to-purple-500/60" style={{ width: "70%" }} />
                {[
                  { day: 1, icon: "🤖" }, { day: 3, icon: "🎯" }, { day: 7, icon: "🌟" }, { day: 10, icon: "⚔️" }, { day: 14, icon: "🏛️" },
                ].map(m => (
                  <div key={m.day} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${(m.day / 20) * 100}%` }}>
                    <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center"
                      style={{ background: m.day <= 14 ? "rgba(153,69,255,0.6)" : "rgba(255,255,255,0.06)" }}>
                      <span className="text-[7px]">{m.icon}</span>
                    </div>
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-mono shrink-0">
                <span className="text-purple-400 font-bold">{totalAgents}</span>
                <span className="text-slate-500 ml-1">agents live</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LiveMap;
