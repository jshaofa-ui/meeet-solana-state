import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Simple deterministic hash using Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simulate Ed25519 signature (deterministic HMAC-based for demo)
async function simulateEd25519Sign(data: string, agentId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`agent_key_${agentId}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function canonicalJson(obj: Record<string, unknown>): Promise<string> {
  const sorted = Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/audit-signet\/?/, "").split("/").filter(Boolean);
  const route = pathParts[0] || "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  try {
    // POST /audit-signet/log
    if (req.method === "POST" && route === "log") {
      const body = await req.json();
      const { agent_id, action_ref, tool_name, tool_params, tool_result } = body;

      if (!agent_id || !action_ref || !tool_name) {
        return jsonResponse({ error: "agent_id, action_ref, and tool_name are required" }, 400);
      }

      // Get last receipt for this agent
      const { data: lastReceipt } = await supabase
        .from("audit_logs")
        .select("receipt_id, receipt_hash")
        .eq("agent_id", agent_id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      const previous_receipt_id = lastReceipt?.receipt_id || null;
      const now = new Date().toISOString();
      const epoch = Math.floor(Date.now() / 600000);

      // Count existing receipts for this agent to generate receipt_id
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact" })
        .eq("agent_id", agent_id)
        .limit(0);

      const receipt_id = `receipt_${String((count ?? 0) + 1).padStart(5, "0")}`;

      // Compute receipt hash
      const canonical = await canonicalJson({
        action_ref,
        tool_name,
        tool_result: tool_result || {},
        previous_receipt_id: previous_receipt_id || "",
        timestamp: now,
      });
      const receipt_hash = await sha256(canonical);

      // Sign with agent key
      const ed25519_signature = await simulateEd25519Sign(receipt_hash, agent_id);

      const { data, error } = await supabase
        .from("audit_logs")
        .insert({
          agent_id,
          action_ref,
          tool_name,
          tool_params: tool_params || {},
          tool_result: tool_result || {},
          receipt_id,
          previous_receipt_id,
          receipt_hash,
          ed25519_signature,
          timestamp: now,
          epoch,
        })
        .select()
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({
        receipt_id,
        receipt_hash,
        signature: ed25519_signature,
        chain_length: (count ?? 0) + 1,
        previous_receipt_id,
      });
    }

    // GET /audit-signet/agent/:agentId
    if (req.method === "GET" && route === "agent") {
      const agentId = pathParts[1];
      if (!agentId) return jsonResponse({ error: "agentId required" }, 400);

      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
      const offset = (page - 1) * limit;
      const actionFilter = url.searchParams.get("action_ref");
      const toolFilter = url.searchParams.get("tool_name");

      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .eq("agent_id", agentId)
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      if (actionFilter) query = query.eq("action_ref", actionFilter);
      if (toolFilter) query = query.eq("tool_name", toolFilter);

      const { data, count, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ receipts: data, total: count, page, limit });
    }

    // GET /audit-signet/verify-chain/:agentId
    if (req.method === "GET" && route === "verify-chain") {
      const agentId = pathParts[1];
      if (!agentId) return jsonResponse({ error: "agentId required" }, 400);

      const { data: chain, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("agent_id", agentId)
        .order("timestamp", { ascending: true });

      if (error) return jsonResponse({ error: error.message }, 500);

      const brokenLinks: string[] = [];
      const invalidSignatures: string[] = [];

      for (let i = 0; i < (chain || []).length; i++) {
        const receipt = chain![i];

        // Verify chain link
        if (i === 0) {
          if (receipt.previous_receipt_id !== null) {
            brokenLinks.push(receipt.receipt_id);
          }
        } else {
          if (receipt.previous_receipt_id !== chain![i - 1].receipt_id) {
            brokenLinks.push(receipt.receipt_id);
          }
        }

        // Verify hash
        const canonical = await canonicalJson({
          action_ref: receipt.action_ref,
          tool_name: receipt.tool_name,
          tool_result: receipt.tool_result || {},
          previous_receipt_id: receipt.previous_receipt_id || "",
          timestamp: receipt.timestamp,
        });
        const expectedHash = await sha256(canonical);
        if (expectedHash !== receipt.receipt_hash) {
          invalidSignatures.push(receipt.receipt_id);
        }

        // Verify signature
        const expectedSig = await simulateEd25519Sign(receipt.receipt_hash, agentId);
        if (expectedSig !== receipt.ed25519_signature) {
          invalidSignatures.push(receipt.receipt_id);
        }
      }

      return jsonResponse({
        chain_valid: brokenLinks.length === 0 && invalidSignatures.length === 0,
        chain_length: chain?.length || 0,
        broken_links: brokenLinks,
        invalid_signatures: [...new Set(invalidSignatures)],
      });
    }

    // GET /audit-signet/receipt/:receiptId
    if (req.method === "GET" && route === "receipt") {
      const receiptId = pathParts[1];
      if (!receiptId) return jsonResponse({ error: "receiptId required" }, 400);

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("receipt_id", receiptId)
        .single();

      if (error) return jsonResponse({ error: error.message }, 404);
      return jsonResponse(data);
    }

    // GET /audit-signet/action/:actionRef
    if (req.method === "GET" && route === "action") {
      const actionRef = pathParts[1];
      if (!actionRef) return jsonResponse({ error: "actionRef required" }, 400);

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action_ref", decodeURIComponent(actionRef))
        .order("timestamp", { ascending: false });

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ receipts: data });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
