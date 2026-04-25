import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Loader2, ExternalLink, Plus, Zap, Sparkles, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { toast } from "sonner";

interface Props {
  userId: string;
}

const QUICK_AMOUNTS = [1, 5, 20, 50];

type PaymentStatus =
  | { kind: "idle" }
  | { kind: "signing"; message: string }
  | { kind: "confirming"; message: string; signature: string }
  | { kind: "verifying"; message: string; signature: string; attempt: number; maxAttempts: number }
  | { kind: "success"; message: string; signature: string; usdCredited: number; newBalance: number }
  | { kind: "error"; message: string; signature?: string };

const VERIFY_MAX_ATTEMPTS = 6;
const VERIFY_RETRY_DELAY_MS = 3000;
const CONFIRM_TIMEOUT_MS = 60_000;

export default function BillingTopUp({ userId }: Props) {
  const qc = useQueryClient();
  const { address, getProvider, connect } = useSolanaWallet();
  const [selectedUsd, setSelectedUsd] = useState<number>(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>({ kind: "idle" });
  const [info, setInfo] = useState<{ treasury_address: string; sol_usd_price: number } | null>(null);

  // Current balance
  const { data: billing } = useQuery({
    queryKey: ["agent-billing", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_billing")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    refetchInterval: 15000,
  });

  // Load treasury info on mount
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("topup-via-sol", { body: { action: "info" } });
      if (!error && data?.success) {
        setInfo({ treasury_address: data.treasury_address, sol_usd_price: data.sol_usd_price });
      }
    })();
  }, []);

  const balanceUsd = billing?.balance_usd ?? 0;
  const totalSpent = billing?.total_spent ?? 0;
  const isLowBalance = balanceUsd < 0.5;

  const solAmount = info ? (selectedUsd / info.sol_usd_price) : 0;

  const handleTopUp = async () => {
    if (!info) return toast.error("Информация о казне ещё не загружена");
    const provider = getProvider();
    if (!provider || !address) {
      toast.error("Сначала подключите Solana кошелёк");
      await connect("phantom");
      return;
    }

    setIsProcessing(true);
    setStatus({ kind: "signing", message: "Ожидаем подпись в кошельке..." });
    let signature = "";
    try {
      // Build SOL transfer transaction
      const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

      const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);
      const fromPubkey = new PublicKey(address);
      const toPubkey = new PublicKey(info.treasury_address);

      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
      );
      tx.feePayer = fromPubkey;
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      if (!provider.signAndSendTransaction) {
        throw new Error("Кошелёк не поддерживает подпись транзакций");
      }
      const sent = await provider.signAndSendTransaction(tx);
      signature = sent.signature;

      setStatus({ kind: "confirming", message: "Подтверждение в сети Solana...", signature });

      // Wait for on-chain confirmation with timeout
      const confirmPromise = conn.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Таймаут подтверждения транзакции (60с)")), CONFIRM_TIMEOUT_MS)
      );
      const confirmation: any = await Promise.race([confirmPromise, timeoutPromise]);
      if (confirmation?.value?.err) {
        throw new Error("Транзакция отклонена сетью");
      }

      // Verify with backend, retrying while RPC propagates
      let lastError = "";
      for (let attempt = 1; attempt <= VERIFY_MAX_ATTEMPTS; attempt++) {
        setStatus({
          kind: "verifying",
          message: `Сверяем платёж с казной (попытка ${attempt}/${VERIFY_MAX_ATTEMPTS})...`,
          signature,
          attempt,
          maxAttempts: VERIFY_MAX_ATTEMPTS,
        });

        await new Promise((r) => setTimeout(r, attempt === 1 ? 1500 : VERIFY_RETRY_DELAY_MS));

        const { data, error } = await supabase.functions.invoke("topup-via-sol", {
          body: { action: "verify", signature, user_id: userId },
        });

        if (!error && data?.success) {
          setStatus({
            kind: "success",
            message: `Зачислено $${data.usd_credited.toFixed(2)} • новый баланс $${data.new_balance.toFixed(2)}`,
            signature,
            usdCredited: data.usd_credited,
            newBalance: data.new_balance,
          });
          toast.success(`💰 Зачислено $${data.usd_credited.toFixed(2)}`);
          qc.invalidateQueries({ queryKey: ["agent-billing", userId] });
          return;
        }

        // Already credited — treat as success
        const errMsg = (error as any)?.message || data?.error || "Не удалось подтвердить платёж";
        if (/already credited/i.test(errMsg)) {
          setStatus({ kind: "success", message: "Платёж уже зачислен", signature, usdCredited: 0, newBalance: balanceUsd });
          qc.invalidateQueries({ queryKey: ["agent-billing", userId] });
          return;
        }
        lastError = errMsg;

        // 404 / not found yet → retry. Other errors → fail fast.
        if (!/not found|try again/i.test(errMsg) && attempt > 1) {
          throw new Error(errMsg);
        }
      }
      throw new Error(lastError || "Платёж не подтверждён после нескольких попыток");
    } catch (e: any) {
      console.error("Top-up failed:", e);
      const msg = e?.message || "Пополнение не удалось";
      setStatus({ kind: "error", message: msg, signature: signature || undefined });
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const retryVerification = async () => {
    if (status.kind !== "error" || !status.signature) return;
    const sig = status.signature;
    setIsProcessing(true);
    try {
      for (let attempt = 1; attempt <= VERIFY_MAX_ATTEMPTS; attempt++) {
        setStatus({
          kind: "verifying",
          message: `Повторная проверка (${attempt}/${VERIFY_MAX_ATTEMPTS})...`,
          signature: sig,
          attempt,
          maxAttempts: VERIFY_MAX_ATTEMPTS,
        });
        await new Promise((r) => setTimeout(r, VERIFY_RETRY_DELAY_MS));
        const { data, error } = await supabase.functions.invoke("topup-via-sol", {
          body: { action: "verify", signature: sig, user_id: userId },
        });
        if (!error && data?.success) {
          setStatus({
            kind: "success",
            message: `Зачислено $${data.usd_credited.toFixed(2)} • новый баланс $${data.new_balance.toFixed(2)}`,
            signature: sig,
            usdCredited: data.usd_credited,
            newBalance: data.new_balance,
          });
          toast.success(`💰 Зачислено $${data.usd_credited.toFixed(2)}`);
          qc.invalidateQueries({ queryKey: ["agent-billing", userId] });
          return;
        }
        const errMsg = (error as any)?.message || data?.error || "Не удалось подтвердить платёж";
        if (/already credited/i.test(errMsg)) {
          setStatus({ kind: "success", message: "Платёж уже зачислен", signature: sig, usdCredited: 0, newBalance: balanceUsd });
          qc.invalidateQueries({ queryKey: ["agent-billing", userId] });
          return;
        }
      }
      setStatus({ kind: "error", message: "Платёж так и не подтверждён. Обратитесь в поддержку с подписью транзакции.", signature: sig });
    } finally {
      setIsProcessing(false);
    }
  };

  const dismissStatus = () => setStatus({ kind: "idle" });

  return (
    <Card className="glass-card border-border overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Баланс агента
          </CardTitle>
          {isLowBalance && (
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
              <AlertCircle className="w-2.5 h-2.5 mr-1" /> Низкий баланс
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current balance */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-3xl font-display font-bold text-foreground">
              ${balanceUsd.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground font-body mt-0.5">
              Потрачено: ${totalSpent.toFixed(2)}
            </div>
          </div>
          {info && (
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Цена SOL</div>
              <div className="text-xs font-mono text-primary">${info.sol_usd_price.toFixed(2)}</div>
            </div>
          )}
        </div>

        {/* Quick top-up amounts */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-2">
            Пополнить через Solana
          </div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((usd) => (
              <button
                key={usd}
                onClick={() => setSelectedUsd(usd)}
                className={`py-2 rounded-lg border text-sm font-display font-bold transition ${
                  selectedUsd === usd
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card hover:border-primary/40 text-foreground"
                }`}
              >
                ${usd}
              </button>
            ))}
          </div>
          {info && (
            <div className="text-[10px] text-muted-foreground font-mono mt-2 text-center">
              ≈ {solAmount.toFixed(5)} SOL
            </div>
          )}
        </div>


        {/* Payment status indicator */}
        {status.kind !== "idle" && (
          <div
            className={`rounded-lg border p-3 space-y-2 ${
              status.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : status.kind === "error"
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-primary/40 bg-primary/10"
            }`}
          >
            <div className="flex items-start gap-2">
              {status.kind === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : status.kind === "error" ? (
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              ) : status.kind === "confirming" || status.kind === "verifying" ? (
                <Loader2 className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-display font-semibold text-foreground">
                  {status.kind === "signing" && "Ожидает подписи"}
                  {status.kind === "confirming" && "Ожидает подтверждения"}
                  {status.kind === "verifying" && "Сверка платежа"}
                  {status.kind === "success" && "Платёж подтверждён"}
                  {status.kind === "error" && "Ошибка платежа"}
                </div>
                <div className="text-[10px] text-muted-foreground font-body mt-0.5 break-words">
                  {status.message}
                </div>
                {"signature" in status && status.signature && (
                  <a
                    href={`https://solscan.io/tx/${status.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1 font-mono"
                  >
                    {status.signature.slice(0, 8)}...{status.signature.slice(-8)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
            {status.kind === "verifying" && (
              <div className="h-1 bg-background/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(status.attempt / status.maxAttempts) * 100}%` }}
                />
              </div>
            )}
            {status.kind === "error" && status.signature && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[10px] border-primary/40"
                onClick={retryVerification}
                disabled={isProcessing}
              >
                <Loader2 className={`w-3 h-3 mr-1 ${isProcessing ? "animate-spin" : "hidden"}`} />
                Проверить ещё раз
              </Button>
            )}
            {(status.kind === "success" || status.kind === "error") && (
              <button
                onClick={dismissStatus}
                className="text-[10px] text-muted-foreground hover:text-foreground transition w-full text-center"
              >
                Скрыть
              </button>
            )}
          </div>
        )}

        {/* Action button */}
        <Button
          variant="hero"
          size="sm"
          className="w-full gap-1.5"
          onClick={handleTopUp}
          disabled={isProcessing || !info}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Обработка...
            </>
          ) : !info ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загрузка...
            </>
          ) : !address ? (
            <>
              <Wallet className="w-3.5 h-3.5" /> Подключить кошелёк для пополнения
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Оплатить {solAmount.toFixed(4)} SOL
            </>
          )}
        </Button>

        {/* Why this matters */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <div className="text-[10px] text-muted-foreground font-body leading-relaxed">
            Balance powers your agents' autonomous AI cycles, chats, discoveries, and Spix calls.
            <span className="text-foreground font-semibold"> 20% of every fee is burned</span> from $MEEET supply.
          </div>
        </div>

        {/* Treasury link */}
        {info && (
          <a
            href={`https://solscan.io/account/${info.treasury_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
          >
            View treasury on Solscan <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
