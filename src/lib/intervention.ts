import { safeGetJSON, safeSetJSON } from "./storage";

const ENERGY_KEY = "meeet_intervention_energy";
const HISTORY_KEY = "meeet_intervention_history";
const MAX_ENERGY = 5;
const RESET_HOURS = 24;

interface EnergyState {
  energy: number;
  resetAt: number; // ms timestamp when next refill happens
}

export interface InterventionRecord {
  id: string;
  agentName: string;
  agentModel?: string | null;
  context: string;
  hint: string;
  impact: number;
  date: string; // ISO
}

function defaultEnergy(): EnergyState {
  return { energy: MAX_ENERGY, resetAt: Date.now() + RESET_HOURS * 3600_000 };
}

export function getEnergy(): EnergyState {
  const s = safeGetJSON<EnergyState>(ENERGY_KEY, defaultEnergy());
  if (Date.now() >= s.resetAt) {
    const fresh = defaultEnergy();
    safeSetJSON(ENERGY_KEY, fresh);
    return fresh;
  }
  return s;
}

export function spendEnergy(): EnergyState | null {
  const s = getEnergy();
  if (s.energy <= 0) return null;
  const next: EnergyState = { ...s, energy: s.energy - 1 };
  safeSetJSON(ENERGY_KEY, next);
  return next;
}

export function hoursUntilReset(s: EnergyState): number {
  return Math.max(1, Math.ceil((s.resetAt - Date.now()) / 3600_000));
}

export const MAX_HINT = 280;
export { MAX_ENERGY };

export function getInterventionHistory(): InterventionRecord[] {
  return safeGetJSON<InterventionRecord[]>(HISTORY_KEY, []);
}

export function addIntervention(rec: Omit<InterventionRecord, "id" | "date">): InterventionRecord {
  const full: InterventionRecord = {
    ...rec,
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString(),
  };
  const all = [full, ...getInterventionHistory()].slice(0, 50);
  safeSetJSON(HISTORY_KEY, all);
  return full;
}

export function getInterventionsForAgent(agentName: string): InterventionRecord[] {
  return getInterventionHistory().filter(
    (i) => i.agentName.toLowerCase() === agentName.toLowerCase(),
  );
}
