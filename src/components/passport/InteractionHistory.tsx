import { useEffect, useState, useRef } from "react";
import { Users, ArrowRight, CheckCircle, Clock, AlertTriangle, Handshake } from "lucide-react";

interface Interaction {
  id: string;
  initiator_id: string;
  responder_id: string;
  interaction_type: string;
  status: string;
  outcome: string | null;
  social_trust_delta: number;
  created_at: string;
  context: Record<string, any>;
}

interface Connection {
  peer_id: string;
  interaction_count: number;
  positive_count: number;
  social_trust_score: number;
}

interface Peer {
  id: string;
  name: string;
  class: string;
  level: number;
}

const TYPE_ICONS: Record<string, string> = {
  verification: "🔍",
  debate: "⚔️",
  governance_vote: "🗳️",
  collaboration: "🤝",
  dispute: "⚡",
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  pending: { color: "text-yellow-400", icon: Clock },
  confirmed_by_initiator: { color: "text-blue-400", icon: ArrowRight },
  confirmed_by_responder: { color: "text-blue-400", icon: ArrowRight },
  confirmed_bilateral: { color: "text-green-400", icon: CheckCircle },
  disputed: { color: "text-red-400", icon: AlertTriangle },
  expired: { color: "text-muted-foreground", icon: Clock },
};

export default function InteractionHistory({ agentId }: { agentId?: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!agentId) { setLoading(false); return; }
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const base = `https://${projectId}.supabase.co/functions/v1/interaction-history`;

    Promise.all([
      fetch(`${base}/agent/${agentId}`).then(r => r.json()),
      fetch(`${base}/graph/${agentId}`).then(r => r.json()),
    ]).then(([ixData, graphData]) => {
      if (ixData.interactions) setInteractions(ixData.interactions);
      if (graphData.connections) setConnections(graphData.connections);
      if (graphData.peers) setPeers(graphData.peers);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [agentId]);

  // Draw mini social graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || connections.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = w / 2;
    const ch = h / 2;

    ctx.clearRect(0, 0, cw, ch);

    const centerX = cw / 2;
    const centerY = ch / 2;
    const radius = Math.min(cw, ch) * 0.35;

    const peerMap = new Map(peers.map(p => [p.id, p]));
    const nodes = connections.map((c, i) => {
      const angle = (2 * Math.PI * i) / connections.length - Math.PI / 2;
      return {
        ...c,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        peer: peerMap.get(c.peer_id),
      };
    });

    // Draw edges
    for (const node of nodes) {
      const trust = node.social_trust_score;
      const alpha = 0.3 + trust * 0.5;
      const green = Math.round(trust * 200);
      const red = Math.round((1 - trust) * 200);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(node.x, node.y);
      ctx.strokeStyle = `rgba(${red}, ${green}, 100, ${alpha})`;
      ctx.lineWidth = 1 + node.interaction_count * 0.3;
      ctx.stroke();
    }

    // Draw center node
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "hsl(260, 80%, 60%)";
    ctx.fill();
    ctx.strokeStyle = "hsl(260, 80%, 80%)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw peer nodes
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
      const trust = node.social_trust_score;
      ctx.fillStyle = trust > 0.6 ? "hsl(150, 70%, 50%)" : trust > 0.3 ? "hsl(45, 80%, 55%)" : "hsl(0, 70%, 55%)";
      ctx.fill();

      if (node.peer) {
        ctx.fillStyle = "hsl(0, 0%, 70%)";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.peer.name.substring(0, 10), node.x, node.y + 14);
      }
    }
  }, [connections, peers]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-2xl" />;
  }

  return (
    <div className="space-y-4">
      {/* Mini Social Graph */}
      {connections.length > 0 && (
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Social Graph</h4>
            <span className="text-xs text-muted-foreground ml-auto">{connections.length} connections</span>
          </div>
          <canvas ref={canvasRef} className="w-full h-40 rounded-xl" style={{ imageRendering: "auto" }} />
          <div className="flex flex-wrap gap-2 mt-3">
            {connections.slice(0, 5).map(c => {
              const peer = peers.find(p => p.id === c.peer_id);
              return (
                <div key={c.peer_id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-xs">
                  <Handshake className="w-3 h-3 text-primary" />
                  <span className="text-foreground">{peer?.name || c.peer_id.substring(0, 8)}</span>
                  <span className="text-muted-foreground">×{c.interaction_count}</span>
                  <span className={c.social_trust_score > 0.6 ? "text-green-400" : c.social_trust_score > 0.3 ? "text-yellow-400" : "text-red-400"}>
                    {(c.social_trust_score * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interaction Timeline */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-foreground text-sm">Recent Interactions</h4>
        </div>
        {interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interactions recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {interactions.slice(0, 15).map(ix => {
              const st = STATUS_CONFIG[ix.status] || STATUS_CONFIG.pending;
              const Icon = st.icon;
              const isInitiator = ix.initiator_id === agentId;
              return (
                <div key={ix.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-lg shrink-0">{TYPE_ICONS[ix.interaction_type] || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-xs truncate">
                      {ix.interaction_type.replace("_", " ")} — {isInitiator ? "initiated" : "responded"}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(ix.created_at).toLocaleDateString()}</p>
                  </div>
                  <Icon className={`w-4 h-4 shrink-0 ${st.color}`} />
                  {ix.social_trust_delta !== 0 && (
                    <span className={`text-xs font-mono ${ix.social_trust_delta > 0 ? "text-green-400" : "text-red-400"}`}>
                      {ix.social_trust_delta > 0 ? "+" : ""}{ix.social_trust_delta.toFixed(2)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
