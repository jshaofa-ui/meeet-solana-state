import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

// Parse arxiv RSS for latest papers
async function fetchArxiv(category: string, maxResults = 5): Promise<{title: string; summary: string; link: string}[]> {
  const url = `http://export.arxiv.org/api/query?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;
  const resp = await fetch(url);
  const text = await resp.text();
  
  const papers: {title: string; summary: string; link: string}[] = [];
  const entries = text.split("<entry>");
  for (let i = 1; i < entries.length && i <= maxResults; i++) {
    const entry = entries[i];
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\n/g, " ") || "";
    const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\n/g, " ").slice(0, 300) || "";
    const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";
    if (title) papers.push({ title, summary, link });
  }
  return papers;
}

const CATEGORIES: Record<string, { arxiv: string; domain: string; agentClass: string }> = {
  "Drug Discovery": { arxiv: "q-bio.BM", domain: "medicine", agentClass: "oracle" },
  "Climate Science": { arxiv: "physics.ao-ph", domain: "climate", agentClass: "miner" },
  "Astrophysics": { arxiv: "astro-ph.EP", domain: "space", agentClass: "oracle" },
  "Quantum Computing": { arxiv: "quant-ph", domain: "technology", agentClass: "oracle" },
  "AI Safety": { arxiv: "cs.AI", domain: "technology", agentClass: "warrior" },
  "Healthcare AI": { arxiv: "cs.CY", domain: "medicine", agentClass: "banker" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const results: { category: string; papers: number; discoveries: number; chats: number }[] = [];

  // Get agents by class for attribution
  const { data: agents } = await sc.from("agents").select("id, name, class").in("status", ["active", "exploring", "trading"]).limit(100);
  const byClass: Record<string, any[]> = {};
  for (const a of (agents || [])) {
    if (!byClass[a.class]) byClass[a.class] = [];
    byClass[a.class]!.push(a);
  }

  for (const [catName, config] of Object.entries(CATEGORIES)) {
    try {
      const papers = await fetchArxiv(config.arxiv, 3);
      let discoveries = 0, chats = 0;

      for (const paper of papers) {
        // Check if we already have this discovery
        const { data: existing } = await sc.from("discoveries")
          .select("id").ilike("title", `%${paper.title.slice(0, 50)}%`).maybeSingle();
        if (existing) continue;

        // Pick a random agent of the right class
        const classAgents = byClass[config.agentClass] || byClass["oracle"] || [];
        if (classAgents.length === 0) continue;
        const agent = classAgents[Math.floor(Math.random() * classAgents.length)];

        // Create discovery
        await sc.from("discoveries").insert({
          title: `arXiv: ${paper.title.slice(0, 180)}`,
          synthesis_text: `${paper.summary.slice(0, 280)}... [Source: ${paper.link}]`,
          domain: config.domain,
          impact_score: 50 + Math.floor(Math.random() * 40),
          upvotes: Math.floor(Math.random() * 20),
          agent_id: agent.id,
        }).catch(() => {});
        discoveries++;

        // Agent posts about it in chat
        await sc.from("agent_messages").insert({
          from_agent_id: agent.id,
          content: `📄 New from arXiv [${catName}]: "${paper.title.slice(0, 100)}..." — ${paper.summary.slice(0, 150)}...`,
          channel: "global",
        }).catch(() => {});
        chats++;
      }

      results.push({ category: catName, papers: papers.length, discoveries, chats });
    } catch (e) {
      results.push({ category: catName, papers: 0, discoveries: 0, chats: 0 });
    }
  }

  return json({ status: "arxiv_scan_complete", results });
});
