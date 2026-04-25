import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractUuid(did: string): string | null {
  const m = did?.match(/did:meeet:agent_(.+)/);
  return m ? m[1] : null;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // POST /interaction-history/confirm/:interactionId
    if (req.method === "POST" && parts.length >= 3 && parts[parts.length - 2] === "confirm") {
      const interactionId = parts[parts.length - 1];
      const body = await req.json();
      const agentUuid = extractUuid(body.agent_did);
      const outcome = body.outcome || "neutral";

      if (!agentUuid) return json({ error: "Invalid agent_did" }, 400);

      const { data: ix, error } = await supabase
        .from("interactions")
        .select("*")
        .eq("id", interactionId)
        .single();

      if (error || !ix) return json({ error: "Interaction not found" }, 404);
      if (ix.status === "confirmed_bilateral") return json({ error: "Already confirmed" }, 400);

      const isInitiator = ix.initiator_id === agentUuid;
      const isResponder = ix.responder_id === agentUuid;
      if (!isInitiator && !isResponder) return json({ error: "Agent not part of this interaction" }, 403);

      const now = new Date().toISOString();
      const updates: Record<string, any> = { outcome };

      if (isInitiator) {
        updates.initiator_confirmed_at = now;
        if (ix.responder_confirmed_at) {
          updates.status = "confirmed_bilateral";
        } else {
          updates.status = "confirmed_by_initiator";
        }
      } else {
        updates.responder_confirmed_at = now;
        if (ix.initiator_confirmed_at) {
          updates.status = "confirmed_bilateral";
        } else {
          updates.status = "confirmed_by_responder";
        }
      }

      await supabase.from("interactions").update(updates).eq("id", interactionId);

      // If bilateral → update social_graph + reputation
      if (updates.status === "confirmed_bilateral") {
        const [agentA, agentB] = orderedPair(ix.initiator_id, ix.responder_id);

        // Upsert social_graph
        const { data: existing } = await supabase
          .from("social_graph")
          .select("*")
          .eq("agent_a", agentA)
          .eq("agent_b", agentB)
          .single();

        const isPositive = outcome === "positive";
        const isNegative = outcome === "negative";

        if (existing) {
          const newCount = existing.interaction_count + 1;
          const newPos = existing.positive_count + (isPositive ? 1 : 0);
          const newNeg = existing.negative_count + (isNegative ? 1 : 0);
          const neutralCount = newCount - newPos - newNeg;
          const trustScore = (newPos * 1.0 + neutralCount * 0.5) / newCount;

          await supabase.from("social_graph").update({
            interaction_count: newCount,
            positive_count: newPos,
            negative_count: newNeg,
            social_trust_score: Math.round(trustScore * 100) / 100,
            last_interaction_at: now,
          }).eq("id", existing.id);

          // Update interaction trust delta
          const delta = trustScore - existing.social_trust_score;
          await supabase.from("interactions").update({ social_trust_delta: Math.round(delta * 100) / 100 }).eq("id", interactionId);
        } else {
          const trustScore = isPositive ? 1.0 : isNegative ? 0.0 : 0.5;
          await supabase.from("social_graph").insert({
            agent_a: agentA,
            agent_b: agentB,
            interaction_count: 1,
            positive_count: isPositive ? 1 : 0,
            negative_count: isNegative ? 1 : 0,
            social_trust_score: trustScore,
            last_interaction_at: now,
          });
          await supabase.from("interactions").update({ social_trust_delta: trustScore - 0.5 }).eq("id", interactionId);
        }

        // +5 reputation for both agents on positive bilateral
        if (isPositive) {
          for (const aid of [ix.initiator_id, ix.responder_id]) {
            const { data: agent } = await supabase.from("agents").select("id, reputation").eq("id", aid).single();
            if (agent) {
              const newRep = (agent.reputation || 0) + 5;
              await supabase.from("agents").update({ reputation: newRep }).eq("id", aid);
              await supabase.from("reputation_log").insert({
                agent_id: aid,
                delta: 5,
                reason: `bilateral_confirmation:${ix.interaction_type}`,
                event_type: "discovery_verified",
                reputation_delta: 5,
                reputation_before: agent.reputation || 0,
                reputation_after: newRep,
              });
            }
          }
        }
      }

      return json({ interaction_id: interactionId, status: updates.status, outcome });
    }

    // POST /interaction-history/create
    if (req.method === "POST") {
      const body = await req.json();
      const initiatorUuid = extractUuid(body.initiator_did);
      const responderUuid = extractUuid(body.responder_did);

      if (!initiatorUuid || !responderUuid) return json({ error: "Invalid DIDs" }, 400);
      if (initiatorUuid === responderUuid) return json({ error: "Cannot interact with self" }, 400);

      const validTypes = ["verification", "debate", "governance_vote", "collaboration", "dispute"];
      if (!validTypes.includes(body.interaction_type)) return json({ error: "Invalid interaction_type" }, 400);

      const { data: ix, error } = await supabase.from("interactions").insert({
        initiator_id: initiatorUuid,
        responder_id: responderUuid,
        interaction_type: body.interaction_type,
        context: body.context || {},
      }).select("id, status, created_at, expires_at").single();

      if (error) return json({ error: error.message }, 500);
      return json({ interaction_id: ix!.id, status: "pending", created_at: ix!.created_at, expires_at: ix!.expires_at });
    }

    // GET /interaction-history/graph/:agentId
    if (req.method === "GET" && parts.length >= 3 && parts[parts.length - 2] === "graph") {
      const agentId = parts[parts.length - 1];
      const { data: linksA } = await supabase.from("social_graph").select("*").eq("agent_a", agentId);
      const { data: linksB } = await supabase.from("social_graph").select("*").eq("agent_b", agentId);

      const links = [...(linksA || []), ...(linksB || [])];
      const peerIds = new Set<string>();
      for (const l of links) {
        peerIds.add(l.agent_a === agentId ? l.agent_b : l.agent_a);
      }

      const peers: any[] = [];
      if (peerIds.size > 0) {
        const ids = Array.from(peerIds);
        // Batch in chunks of 50
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50);
          const { data } = await supabase.from("agents").select("id, name, class, level, reputation").in("id", chunk);
          if (data) peers.push(...data);
        }
      }

      return json({
        agent_id: agentId,
        connections: links.map(l => ({
          peer_id: l.agent_a === agentId ? l.agent_b : l.agent_a,
          interaction_count: l.interaction_count,
          positive_count: l.positive_count,
          negative_count: l.negative_count,
          social_trust_score: l.social_trust_score,
          last_interaction_at: l.last_interaction_at,
        })),
        peers,
        total_connections: links.length,
      });
    }

    // GET /interaction-history/agent/:agentId
    if (req.method === "GET" && parts.length >= 3) {
      const agentId = parts[parts.length - 1];
      const typeFilter = url.searchParams.get("type");
      const statusFilter = url.searchParams.get("status");

      let query = supabase
        .from("interactions")
        .select("*")
        .or(`initiator_id.eq.${agentId},responder_id.eq.${agentId}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (typeFilter) query = query.eq("interaction_type", typeFilter);
      if (statusFilter) query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ agent_id: agentId, interactions: data || [], total: data?.length || 0 });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
