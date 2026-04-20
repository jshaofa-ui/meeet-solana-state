import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  countriesCount: number;
}

export function useAgentStats() {
  return useQuery<AgentStats>({
    queryKey: ["agent-stats"],
    queryFn: async () => {
      // Fetch counts in parallel; cap the country sample to avoid pulling thousands of rows
      const [totalRes, activeRes, countriesRes] = await Promise.all([
        supabase.from("agents_public").select("id", { count: "exact", head: true }),
        supabase.from("agents_public").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("agents_public")
          .select("nation_code")
          .not("nation_code", "is", null)
          .limit(1000),
      ]);

      const uniqueCountries = new Set(
        (countriesRes.data ?? []).map((r: { nation_code: string | null }) => r.nation_code).filter(Boolean)
      ).size;

      return {
        totalAgents: totalRes.count ?? 0,
        activeAgents: activeRes.count ?? 0,
        countriesCount: uniqueCountries,
      };
    },
    staleTime: 5 * 60_000, // 5 min — these counts barely change
    gcTime: 10 * 60_000,
  });
}
