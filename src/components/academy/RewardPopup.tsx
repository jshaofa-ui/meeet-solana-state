import { useEffect } from "react";
import { Coins } from "lucide-react";

interface Props {
  amount: number;
  doubled?: boolean;
  onDone: () => void;
}

const CONFETTI = ["🎉", "✨", "⭐", "💰", "🪙", "🎊"];

const RewardPopup = ({ amount, doubled, onDone }: Props) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
      {/* CSS confetti */}
      {[...Array(18)].map((_, i) => (
        <span
          key={i}
          className="absolute text-2xl select-none"
          style={{
            left: `${50 + (Math.cos((i / 18) * Math.PI * 2) * 30)}%`,
            top: `${50 + (Math.sin((i / 18) * Math.PI * 2) * 25)}%`,
            animation: `confetti-burst 1.6s ease-out forwards`,
            animationDelay: `${i * 0.04}s`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}
      <div
        className="px-8 py-6 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-black font-extrabold shadow-2xl shadow-amber-500/60 flex items-center gap-3"
        style={{ animation: "reward-pop 0.5s cubic-bezier(.2,1.4,.4,1) both" }}
      >
        <Coins className="w-8 h-8" />
        <div className="flex flex-col items-start">
          <div className="text-3xl leading-none">+{amount} MEEET</div>
          {doubled && (
            <div className="text-xs font-bold mt-1 text-amber-900">🔥 2× streak bonus</div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes confetti-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + ${0}px), calc(-50% - 80px)) scale(1.2) rotate(360deg); }
        }
        @keyframes reward-pop {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default RewardPopup;
