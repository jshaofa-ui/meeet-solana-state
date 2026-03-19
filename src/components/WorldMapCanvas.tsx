import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";

// ──── Pixel Sprites (7×7) ────
// Each sprite is a 7×7 grid where 1 = filled, 0 = transparent
const SPRITE_DATA: Record<string, number[][]> = {
  warrior: [
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,1,0,1,0,0],
    [0,1,1,0,1,1,0],
  ],
  trader: [
    [0,0,1,1,1,0,0],
    [0,1,0,0,0,1,0],
    [1,0,1,0,0,0,1],
    [1,0,0,1,0,0,1],
    [1,0,0,0,1,0,1],
    [0,1,0,0,0,1,0],
    [0,0,1,1,1,0,0],
  ],
  scout: [
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,0,1,0,1,0],
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,0,1,0,1,0,0],
    [0,1,0,0,0,1,0],
  ],
  diplomat: [
    [0,1,1,1,1,1,0],
    [0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1],
    [0,0,0,1,0,0,0],
    [0,0,1,0,1,0,0],
    [0,1,0,0,0,1,0],
  ],
  builder: [
    [0,1,1,1,1,0,0],
    [0,1,0,0,0,0,0],
    [0,1,1,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,0,0,0,1,0],
    [0,1,1,1,1,1,0],
  ],
  hacker: [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1],
    [0,0,1,0,1,0,0],
    [0,1,1,1,1,1,0],
  ],
  president: [
    [0,0,1,1,1,0,0],
    [0,1,0,1,0,1,0],
    [1,1,1,1,1,1,1],
    [0,0,1,1,1,0,0],
    [0,0,1,1,1,0,0],
    [0,0,1,0,1,0,0],
    [0,1,1,0,1,1,0],
  ],
  oracle: [
    [0,0,1,1,1,0,0],
    [0,1,0,0,0,1,0],
    [1,0,0,1,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,1,0,0,1],
    [0,1,0,0,0,1,0],
    [0,0,1,1,1,0,0],
  ],
  miner: [
    [0,0,0,0,1,1,0],
    [0,0,0,1,0,0,0],
    [0,0,1,0,0,0,0],
    [0,1,0,0,0,0,0],
    [1,1,1,0,0,0,0],
    [0,1,0,0,0,0,0],
    [0,1,0,0,0,0,0],
  ],
  banker: [
    [0,1,1,1,1,1,0],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,0,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [0,1,1,1,1,1,0],
  ],
};

// Event sprites
const EVENT_SPRITES: Record<string, number[][]> = {
  conflict: [
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
    [0,1,0,1,0],
    [1,0,0,0,1],
  ],
  disaster: [
    [0,0,1,0,0],
    [0,1,1,1,0],
    [0,1,1,1,0],
    [1,1,1,1,1],
    [0,1,1,1,0],
  ],
  discovery: [
    [0,0,1,0,0],
    [0,1,0,1,0],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
  ],
  diplomacy: [
    [0,1,0,1,0],
    [1,1,0,1,1],
    [0,0,1,0,0],
    [1,1,0,1,1],
    [0,1,0,1,0],
  ],
};

const AGENT_COLORS: Record<string, string> = {
  warrior: "#ff4444", trader: "#ffbb33", scout: "#44ff88",
  diplomat: "#4488ff", builder: "#bb66ff", hacker: "#ff66bb",
  president: "#ffdd00", oracle: "#ffcc44", miner: "#44ddff", banker: "#aa66ff",
};

const EVENT_COLORS: Record<string, string> = {
  conflict: "#ff3333", disaster: "#ff8800", discovery: "#33aaff", diplomacy: "#33ff88",
};

interface AgentGeo {
  lng: number; lat: number; color: string; rep: number; name: string; cls: string;
}
interface EventGeo {
  lng: number; lat: number; color: string; type: string;
}
interface Props {
  agentGeoData: AgentGeo[];
  eventGeoData: EventGeo[];
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
}

// ──── Pixel rendering helpers ────
function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  x: number, y: number,
  pixelSize: number,
  color: string,
  alpha = 1,
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const h = sprite.length;
  const w = sprite[0].length;
  const ox = x - (w * pixelSize) / 2;
  const oy = y - (h * pixelSize) / 2;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (sprite[row][col]) {
        ctx.fillRect(
          Math.floor(ox + col * pixelSize),
          Math.floor(oy + row * pixelSize),
          pixelSize, pixelSize,
        );
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number, pixelSize: number,
  color: string, alpha = 1,
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const steps = Math.ceil(radius * 2 / pixelSize);
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const px = i * pixelSize;
      const py = j * pixelSize;
      if (Math.sqrt(px * px + py * py) <= radius) {
        ctx.fillRect(
          Math.floor(cx + px - pixelSize / 2),
          Math.floor(cy + py - pixelSize / 2),
          pixelSize, pixelSize,
        );
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ──── Main Component ────
const WorldMapCanvas = ({ agentGeoData, eventGeoData, mapRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const agentsRef = useRef(agentGeoData);
  const eventsRef = useRef(eventGeoData);
  agentsRef.current = agentGeoData;
  eventsRef.current = eventGeoData;

  // Animation particles
  const sparkles = useRef<Array<{ x: number; y: number; life: number; maxLife: number; color: string }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let running = true;

    const animate = () => {
      if (!running) return;
      frameRef.current++;
      const map = mapRef.current;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = devicePixelRatio || 1;
      // Render at half res for pixel art crispness
      const renderScale = 0.5;
      const rw = Math.floor(w * renderScale);
      const rh = Math.floor(h * renderScale);

      if (canvas.width !== rw || canvas.height !== rh) {
        canvas.width = rw;
        canvas.height = rh;
      }

      ctx.clearRect(0, 0, rw, rh);

      if (!map || (map as any)._removed) {
        requestAnimationFrame(animate);
        return;
      }

      const frame = frameRef.current;
      const pixelSize = 2; // Base pixel size at render resolution

      // Project agents
      const agents = agentsRef.current.map(a => {
        const pt = map.project([a.lng, a.lat]);
        return { x: pt.x * renderScale, y: pt.y * renderScale, ...a };
      }).filter(d => d.x >= -30 && d.x <= rw + 30 && d.y >= -30 && d.y <= rh + 30);

      // Project events
      const events = eventsRef.current.map(e => {
        const pt = map.project([e.lng, e.lat]);
        return { x: pt.x * renderScale, y: pt.y * renderScale, ...e };
      }).filter(d => d.x >= -30 && d.x <= rw + 30 && d.y >= -30 && d.y <= rh + 30);

      // ── Grid overlay (subtle) ──
      ctx.strokeStyle = "rgba(100,140,255,0.04)";
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let gx = 0; gx < rw; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, rh); ctx.stroke();
      }
      for (let gy = 0; gy < rh; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(rw, gy); ctx.stroke();
      }

      // ── Connection lines (pixelated) ──
      if (agents.length > 1 && agents.length < 80) {
        for (let i = 0; i < agents.length; i++) {
          for (let j = i + 1; j < Math.min(agents.length, i + 8); j++) {
            const a = agents[i], b = agents[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 50 && dist > 5) {
              const alpha = (1 - dist / 50) * 0.15;
              // Draw pixelated line
              ctx.fillStyle = `rgba(100,140,255,${alpha})`;
              const steps = Math.floor(dist / pixelSize);
              for (let s = 0; s < steps; s++) {
                const t = s / steps;
                const lx = Math.floor((a.x + (b.x - a.x) * t) / pixelSize) * pixelSize;
                const ly = Math.floor((a.y + (b.y - a.y) * t) / pixelSize) * pixelSize;
                ctx.fillRect(lx, ly, pixelSize, pixelSize);
              }
            }
          }
        }
      }

      // ── Event markers ──
      for (const ev of events) {
        const sprite = EVENT_SPRITES[ev.type];
        const color = EVENT_COLORS[ev.type] || "#ff44ff";

        // Pulsing glow
        const pulse = 0.3 + 0.3 * Math.sin(frame * 0.08 + ev.x * 0.1);
        drawPixelCircle(ctx, ev.x, ev.y, 12, pixelSize, color, pulse * 0.3);

        // Blinking sprite (RPG quest marker style)
        const blink = Math.sin(frame * 0.1 + ev.y * 0.05) > -0.3;
        if (blink && sprite) {
          drawSprite(ctx, sprite, ev.x, ev.y, pixelSize, color, 0.9);
        }

        // Exclamation mark above (quest marker!)
        if (frame % 60 < 45) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          // "!" shape
          ctx.fillRect(Math.floor(ev.x - pixelSize / 2), Math.floor(ev.y - 16), pixelSize, pixelSize * 3);
          ctx.fillRect(Math.floor(ev.x - pixelSize / 2), Math.floor(ev.y - 10), pixelSize, pixelSize);
          ctx.globalAlpha = 1;
        }
      }

      // ── Agent sprites ──
      for (const agent of agents) {
        const sprite = SPRITE_DATA[agent.cls] || SPRITE_DATA.warrior;
        const color = AGENT_COLORS[agent.cls] || "#ff44ff";
        const spritePixel = Math.max(pixelSize, Math.min(3, 2 + Math.floor(agent.rep / 200)));

        // Shadow
        drawSprite(ctx, sprite, agent.x + 1, agent.y + 1, spritePixel, "#000000", 0.3);

        // Bounce animation
        const bounce = Math.abs(Math.sin(frame * 0.06 + agent.x * 0.03)) * 2;
        const drawY = agent.y - bounce;

        // Main sprite
        drawSprite(ctx, sprite, agent.x, drawY, spritePixel, color, 0.95);

        // Name label (pixel font simulation)
        if (agents.length < 60) {
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.7;
          ctx.font = `${6}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(agent.name.slice(0, 8), agent.x, agent.y + 14);
          ctx.globalAlpha = 1;
        }

        // Level indicator (dots)
        const lvlDots = Math.min(agent.rep > 0 ? Math.ceil(agent.rep / 100) : 1, 5);
        for (let d = 0; d < lvlDots; d++) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(
            Math.floor(agent.x - (lvlDots * 3) / 2 + d * 3),
            Math.floor(agent.y + 17),
            pixelSize, pixelSize,
          );
        }
        ctx.globalAlpha = 1;
      }

      // ── Sparkle particles ──
      if (agents.length > 0 && frame % 8 === 0 && sparkles.current.length < 60) {
        const a = agents[Math.floor(Math.random() * agents.length)];
        sparkles.current.push({
          x: a.x + (Math.random() - 0.5) * 12,
          y: a.y + (Math.random() - 0.5) * 12,
          life: 0, maxLife: 20 + Math.random() * 25,
          color: AGENT_COLORS[a.cls] || "#ffffff",
        });
      }

      sparkles.current = sparkles.current.filter(s => {
        s.life++;
        if (s.life >= s.maxLife) return false;
        s.y -= 0.3;
        const alpha = 1 - s.life / s.maxLife;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(
          Math.floor(s.x / pixelSize) * pixelSize,
          Math.floor(s.y / pixelSize) * pixelSize,
          pixelSize, pixelSize,
        );
        ctx.globalAlpha = 1;
        return true;
      });

      // ── Scanline CRT effect ──
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      for (let sy = 0; sy < rh; sy += 4) {
        ctx.fillRect(0, sy, rw, 1);
      }

      // ── Vignette corners ──
      const vGrad = ctx.createRadialGradient(rw / 2, rh / 2, rh * 0.3, rw / 2, rh / 2, rh * 0.8);
      vGrad.addColorStop(0, "transparent");
      vGrad.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, rw, rh);

      requestAnimationFrame(animate);
    };

    animate();
    return () => { running = false; };
  }, [mapRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 5,
        imageRendering: "pixelated",
        // The canvas is rendered at half resolution — CSS scales it up crispy
      }}
    />
  );
};

export default WorldMapCanvas;
