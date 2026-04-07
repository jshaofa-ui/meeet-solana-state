import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { CheckCircle, XCircle, Link2, Clock, Shield, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditReceipt {
  id: string;
  receipt_id: string;
  action_ref: string;
  tool_name: string;
  receipt_hash: string;
  previous_receipt_id: string | null;
  ed25519_signature: string;
  timestamp: string;
  epoch: number;
}

interface ChainVerification {
  chain_valid: boolean;
  chain_length: number;
  broken_links: string[];
  invalid_signatures: string[];
}

export default function AuditTrailSection({ agentId }: { agentId?: string }) {
  const [verifyResult, setVerifyResult] = useState<ChainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-trail", agentId],
    queryFn: async () => {
      if (!agentId) return { receipts: [], total: 0 };
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("agent_id", agentId)
        .order("timestamp", { ascending: false })
        .limit(20);
      return { receipts: (data || []) as AuditReceipt[], total: data?.length || 0 };
    },
    enabled: !!agentId,
  });

  const verifyChain = async () => {
    if (!agentId) return;
    setVerifying(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/audit-signet/verify-chain/${agentId}`,
        { headers: { "Content-Type": "application/json" } }
      );
      const result = await res.json();
      setVerifyResult(result);
    } catch {
      setVerifyResult({ chain_valid: false, chain_length: 0, broken_links: ["error"], invalid_signatures: [] });
    } finally {
      setVerifying(false);
    }
  };

  const receipts = data?.receipts || [];

  return (
    <div className="space-y-4">
      {/* Header with verify button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-sm text-muted-foreground">{receipts.length} receipts</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={verifyChain}
          disabled={verifying || receipts.length === 0}
          className="gap-2"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Verify Chain
        </Button>
      </div>

      {/* Verification result */}
      {verifyResult && (
        <div className={`rounded-xl border p-4 ${verifyResult.chain_valid ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <div className="flex items-center gap-2 mb-1">
            {verifyResult.chain_valid ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span className={`font-semibold text-sm ${verifyResult.chain_valid ? "text-green-400" : "text-red-400"}`}>
              {verifyResult.chain_valid ? "Chain Valid" : "Chain Broken"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {verifyResult.chain_length} receipts verified
            {verifyResult.broken_links.length > 0 && ` · ${verifyResult.broken_links.length} broken links`}
            {verifyResult.invalid_signatures.length > 0 && ` · ${verifyResult.invalid_signatures.length} invalid signatures`}
          </p>
        </div>
      )}

      {/* Receipt timeline */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : receipts.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No audit receipts yet</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-3">
            {receipts.map((r, i) => {
              const isExpanded = expandedReceipt === r.receipt_id;
              return (
                <div key={r.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 top-3 w-3 h-3 rounded-full bg-primary/60 border-2 border-background z-10" />

                  <button
                    onClick={() => setExpandedReceipt(isExpanded ? null : r.receipt_id)}
                    className="w-full text-left bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono text-primary">{r.receipt_id}</span>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{r.tool_name}</span>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{r.action_ref}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(r.timestamp).toLocaleString()}</span>
                      {r.previous_receipt_id && (
                        <>
                          <Link2 className="w-3 h-3 ml-2" />
                          <span className="font-mono">{r.previous_receipt_id}</span>
                        </>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Receipt Hash</span>
                          <p className="font-mono text-[11px] text-foreground break-all">{r.receipt_hash}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ed25519 Signature</span>
                          <p className="font-mono text-[11px] text-foreground break-all">{r.ed25519_signature}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Epoch</span>
                          <p className="text-xs text-foreground">{r.epoch}</p>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
