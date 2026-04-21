/**
 * Round 24 — shared helpers for agent_interactions.
 * Keeps types, colors and labels in one place so /live and AgentProfile stay in sync.
 */

export type InteractionType =
  | "debate"
  | "discovery_review"
  | "prediction"
  | "governance";

export interface AgentInteractionRow {
  id: string;
  agent_id: string | null;
  opponent_id: string | null;
  interaction_type: InteractionType | string;
  result: string | null;
  topic: string | null;
  summary: string | null;
  agent_argument: string | null;
  opponent_argument: string | null;
  learned_pattern: string | null;
  meeet_earned: number | null;
  created_at: string;
}

export const INTERACTION_META: Record<
  InteractionType,
  { icon: string; color: string; bg: string; ring: string }
> = {
  debate: {
    icon: "🗡️",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    ring: "ring-rose-500/40",
  },
  discovery_review: {
    icon: "🔬",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    ring: "ring-emerald-500/40",
  },
  prediction: {
    icon: "🔮",
    color: "text-sky-300",
    bg: "bg-sky-500/15",
    ring: "ring-sky-500/40",
  },
  governance: {
    icon: "🏛️",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    ring: "ring-amber-500/40",
  },
};

export function timeAgo(iso: string, isRu = true): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return isRu ? "только что" : "now";
  if (min < 60) return isRu ? `${min} мин` : `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return isRu ? `${h} ч` : `${h}h`;
  const d = Math.floor(h / 24);
  return isRu ? `${d} дн` : `${d}d`;
}

export function isWin(row: AgentInteractionRow): boolean {
  if (row.interaction_type !== "debate") return false;
  return row.result === "win";
}
