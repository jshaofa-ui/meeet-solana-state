import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Coins, Flame, Sparkles, Lock, Trophy, Copy, Check, Users, Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  FOUNDATIONS_CERT_COST,
  MASTERY_UNLOCK_COST,
  addBalance,
  setFoundationsCertified,
  setMasteryUnlocked,
} from "@/lib/academy-rewards";

/* ---------- Balance + Streak pill ---------- */
export const BalanceStreakPill = ({ balance, streak }: { balance: number; streak: number }) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm font-semibold">
      <Coins className="w-4 h-4" />
      Баланс: <span className="text-amber-100">{balance} MEEET</span>
    </div>
    {streak > 0 && (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-200 text-sm font-semibold">
        <Flame className="w-4 h-4" />
        Серия {streak} дн. {streak >= 3 && <span className="text-amber-300">— награда ×2!</span>}
      </div>
    )}
  </div>
);

/* ---------- Earnings preview banner ---------- */
export const EarningsBanner = () => (
  <div className="mb-6 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-700/40 via-violet-700/30 to-blue-700/30 p-5 flex items-start gap-3">
    <Sparkles className="w-6 h-6 text-amber-300 flex-shrink-0 mt-0.5" />
    <div className="text-sm md:text-base text-white">
      Пройди все 20 уроков и заработай до{" "}
      <span className="font-bold text-amber-300">650 MEEET</span>. Лучшие выпускники получат{" "}
      <span className="font-semibold text-purple-200">ранний доступ к Agent Deployment</span>.
    </div>
  </div>
);

/* ---------- Tier section header ---------- */
export const TierHeader = ({
  title,
  subtitle,
  locked,
  earnedBadge,
}: {
  title: string;
  subtitle: string;
  locked?: boolean;
  earnedBadge?: string;
}) => (
  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
    <div className="flex items-center gap-2">
      {locked && <Lock className="w-4 h-4 text-gray-400" />}
      <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
      <span className="text-xs md:text-sm text-gray-400">— {subtitle}</span>
    </div>
    {earnedBadge && (
      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
        {earnedBadge}
      </Badge>
    )}
  </div>
);

/* ---------- Mastery lock overlay ---------- */
export const MasteryLockCard = ({
  balance,
  onUnlocked,
}: {
  balance: number;
  onUnlocked: () => void;
}) => {
  const canAfford = balance >= MASTERY_UNLOCK_COST;
  const handleUnlock = () => {
    if (!canAfford) {
      toast.error(`Нужно ещё ${MASTERY_UNLOCK_COST - balance} MEEET`);
      return;
    }
    addBalance(-MASTERY_UNLOCK_COST);
    setMasteryUnlocked();
    toast.success("🎉 Уроки Мастерства разблокированы!");
    onUnlocked();
  };
  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-background p-6 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-5 h-5 text-purple-300" />
        <h3 className="text-lg font-bold text-white">Уроки Мастерства заблокированы</h3>
      </div>
      <p className="text-sm text-gray-300 mb-4">
        Разблокируй уроки 15–20, чтобы заработать по 50 MEEET и стать Мастером.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/trust-api">
          <Button className="bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white">
            <Rocket className="w-4 h-4 mr-2" />
            Задеплой первого агента
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={handleUnlock}
          className="border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100"
        >
          <Coins className="w-4 h-4 mr-2" />
          Разблокировать за {MASTERY_UNLOCK_COST} MEEET
          {!canAfford && <span className="ml-2 text-xs">(нужно ещё {MASTERY_UNLOCK_COST - balance})</span>}
        </Button>
      </div>
    </div>
  );
};

/* ---------- Foundations Certificate Modal ---------- */
export const FoundationsCertModal = ({
  open,
  balance,
  onClose,
  onMinted,
}: {
  open: boolean;
  balance: number;
  onClose: () => void;
  onMinted: () => void;
}) => {
  if (!open) return null;
  const canAfford = balance >= FOUNDATIONS_CERT_COST;
  const handleMint = () => {
    if (!canAfford) return;
    addBalance(-FOUNDATIONS_CERT_COST);
    setFoundationsCertified();
    toast.success("🏆 Foundations Certificate minted on-chain!");
    onMinted();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-md w-full rounded-3xl bg-gradient-to-br from-purple-800 via-violet-800 to-purple-950 border border-purple-300/40 shadow-2xl shadow-purple-500/40 p-8 text-center animate-scale-in">
        <Trophy className="w-16 h-16 mx-auto text-amber-300 mb-3" />
        <h3 className="text-2xl font-extrabold text-white mb-2">Foundations Certificate Unlocked!</h3>
        <p className="text-purple-100 text-sm mb-5">
          You mastered the basics of AI agents and Web3. Mint your certificate as an on-chain credential
          for <span className="font-bold text-amber-300">{FOUNDATIONS_CERT_COST} MEEET</span>.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            disabled={!canAfford}
            onClick={handleMint}
            className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-bold"
          >
            {canAfford
              ? `Mint Certificate (${FOUNDATIONS_CERT_COST} MEEET)`
              : `Earn ${FOUNDATIONS_CERT_COST - balance} more MEEET to mint`}
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-purple-200 hover:bg-white/10">
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Referral card ---------- */
export const ReferralCard = ({ refId, count }: { refId: string; count: number }) => {
  const [copied, setCopied] = useState(false);
  const link = `https://meeet.world/academy?ref=${refId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Реферальная ссылка скопирована!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };
  return (
    <div className="mt-10 rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/40 to-background p-6">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-purple-300" />
        <h3 className="text-lg font-bold text-white">Пригласи друзей — получи 100 MEEET за каждого</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">Поделись ссылкой. Когда друг присоединится к Академии, оба получите награду.</p>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input readOnly value={link} className="bg-black/40 border-purple-500/30 text-white text-sm" />
        <Button onClick={copy} className="bg-purple-600 hover:bg-purple-500 text-white">
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? "Скопировано" : "Скопировать"}
        </Button>
      </div>
      <div className="text-xs text-gray-300">
        Рефералы: <span className="font-bold text-purple-200">{count}</span>
      </div>
    </div>
  );
};
