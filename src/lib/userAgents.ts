import { safeGetJSON } from "./storage";

interface DeployedAgent {
  id: string;
  name: string;
  type?: string;
  focus?: string;
  deployedAt?: string;
}

const STORAGE_KEY = "meeet_deployed_agents";

export function getMyDeployedAgents(): DeployedAgent[] {
  return safeGetJSON<DeployedAgent[]>(STORAGE_KEY, []);
}

export function getMyAgentNames(): Set<string> {
  return new Set(getMyDeployedAgents().map((a) => a.name.toLowerCase()));
}

export function isMyAgent(agentName: string | null | undefined): boolean {
  if (!agentName) return false;
  return getMyAgentNames().has(agentName.toLowerCase());
}
