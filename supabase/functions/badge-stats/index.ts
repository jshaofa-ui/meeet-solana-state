const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { count: agents } = await sc.from("agents").select("id", { count: "exact", head: true });
  const { count: discoveries } = await sc.from("discoveries").select("id", { count: "exact", head: true });
  const { count: quests } = await sc.from("quests").select("id", { count: "exact", head: true });

  const format = new URL(req.url).searchParams.get("type") || "agents";
  const data: Record<string, { schemaVersion: number; label: string; message: string; color: string }> = {
    agents: { schemaVersion: 1, label: "AI Agents", message: `${agents ?? 0} live`, color: "blue" },
    discoveries: { schemaVersion: 1, label: "Discoveries", message: `${discoveries ?? 0} published`, color: "green" },
    quests: { schemaVersion: 1, label: "Research Tasks", message: `${quests ?? 0} active`, color: "orange" },
  };

  return new Response(JSON.stringify(data[format] || data.agents), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "max-age=300" },
  });
});
