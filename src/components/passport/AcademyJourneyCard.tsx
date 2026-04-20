import { useEffect, useState } from "react";
import { GraduationCap, Coins, Flame, Award, Lock, Unlock } from "lucide-react";

const TOTAL_LESSONS = 20;

const readNum = (k: string) => {
  try {
    const v = localStorage.getItem(k);
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
};
const readBool = (k: string) => {
  try {
    return localStorage.getItem(k) === "1" || localStorage.getItem(k) === "true";
  } catch {
    return false;
  }
};

const AcademyJourneyCard = () => {
  const [state, setState] = useState({
    completed: 0,
    balance: 0,
    streak: 0,
    certified: false,
    masteryUnlocked: false,
  });

  useEffect(() => {
    let completed = 0;
    try {
      const rewarded = localStorage.getItem("meeet_rewarded_slugs");
      if (rewarded) completed = JSON.parse(rewarded).length || 0;
    } catch {}
    setState({
      completed,
      balance: readNum("meeet_academy_balance"),
      streak: readNum("meeet_streak_count"),
      certified: readBool("meeet_certified_foundations"),
      masteryUnlocked: readBool("meeet_mastery_unlocked"),
    });
  }, []);

  const pct = Math.min(100, Math.round((state.completed / TOTAL_LESSONS) * 100));
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <section className="max-w-6xl mx-auto px-4 mb-20">
      <h2 className="text-2xl font-bold text-white mb-2">Your Academy Journey</h2>
      <p className="text-sm text-gray-400 mb-6">Track your progress, earnings, and unlocks.</p>
      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/40 p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
          {/* Progress ring */}
          <div className="relative w-32 h-32 mx-auto md:mx-0">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="url(#academy-grad)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
              <defs>
                <linearGradient id="academy-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-black text-white">{pct}%</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Complete</div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              icon={<GraduationCap className="w-4 h-4 text-purple-300" />}
              label="Lessons"
              value={`${state.completed} / ${TOTAL_LESSONS}`}
            />
            <Stat
              icon={<Coins className="w-4 h-4 text-amber-300" />}
              label="MEEET Earned"
              value={state.balance.toLocaleString()}
            />
            <Stat
              icon={<Flame className="w-4 h-4 text-orange-300" />}
              label="Streak"
              value={`${state.streak} day${state.streak === 1 ? "" : "s"}`}
            />
            <Stat
              icon={<Award className="w-4 h-4 text-emerald-300" />}
              label="Certificates"
              value={state.certified ? "1 minted" : "0"}
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
              state.masteryUnlocked
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-gray-600/40 bg-gray-700/20 text-gray-300"
            }`}
          >
            {state.masteryUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            Mastery {state.masteryUnlocked ? "Unlocked" : "Locked"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
              state.certified
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-gray-600/40 bg-gray-700/20 text-gray-300"
            }`}
          >
            <Award className="w-3 h-3" />
            Foundations Certificate {state.certified ? "Minted" : "Not Yet Minted"}
          </span>
        </div>
      </div>
    </section>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-400 mb-1">
      {icon}
      {label}
    </div>
    <div className="text-lg font-bold text-white">{value}</div>
  </div>
);

export default AcademyJourneyCard;
