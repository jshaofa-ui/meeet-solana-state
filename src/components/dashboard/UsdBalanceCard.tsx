import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export default function UsdBalanceCard({ userId }: { userId: string }) {
  const { t } = useLanguage();

  const { data: balance } = useQuery({
    queryKey: ["user-balance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_balance")
        .select("*")
        .eq("user_id", userId)
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  const { data: billing } = useQuery({
    queryKey: ["agent-billing", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_billing")
        .select("*")
        .eq("user_id", userId)
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  const usdBalance = Number((balance as any)?.balance ?? 0);
  const isLow = usdBalance < 0.1;
  const spixCredits = billing ? Math.max(0, Math.round((Number(billing.balance_usd) || 0) / 0.02)) : null;

  return (
    <div className="space-y-2">
      <Card className={`glass-card border-border overflow-hidden relative ${isLow ? "border-amber-500/20" : ""}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLow ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
              <DollarSign className={`w-4 h-4 ${isLow ? "text-amber-400" : "text-emerald-400"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">{t("balance.aiCredits")}</p>
              <p className={`text-lg font-display font-bold ${isLow ? "text-amber-400" : "text-foreground"}`}>
                ${usdBalance.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-body">~{Math.floor(usdBalance / 0.006)} {t("balance.msgs")}</span>
            <Link to="/pricing">
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <Plus className="w-3 h-3" /> {t("balance.addFunds")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {spixCredits !== null && (
        <Card className="glass-card border-border overflow-hidden relative border-purple-500/10">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-body">📧📞💬 Spix Credits</p>
                <p className="text-sm font-display font-bold text-foreground">{spixCredits.toLocaleString()}</p>
              </div>
            </div>
            <Link to="/pricing">
              <Button variant="ghost" size="sm" className="text-[10px] text-purple-400 hover:text-purple-300">
                Upgrade
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
