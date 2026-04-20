import { useEffect, useState } from "react";
import { Award, Lock, CheckCircle2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

const PAGE_VISIT_KEY = "meeet_pages_visited";

const computeAchievements = (): Achievement[] => {
  if (typeof window === "undefined") {
    return [];
  }
  let completedLessons = 0;
  try {
    const raw = localStorage.getItem("meeet_rewarded_slugs");
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) completedLessons = arr.length;
    }
  } catch {
    completedLessons = 0;
  }
  const streak = parseInt(localStorage.getItem("meeet_streak_count") || "0", 10) || 0;
  const certified = localStorage.getItem("meeet_certified_foundations") === "true";
  let visited = 0;
  try {
    const raw = localStorage.getItem(PAGE_VISIT_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) visited = new Set(arr as string[]).size;
    }
  } catch {
    visited = 0;
  }

  return [
    { key: "first_lesson", name: "First Lesson", description: "Complete 1 Academy lesson", icon: "🎓", earned: completedLessons >= 1 },
    { key: "streak_master", name: "Streak Master", description: "Maintain a 3-day streak", icon: "🔥", earned: streak >= 3 },
    { key: "foundations_grad", name: "Foundations Graduate", description: "Complete lessons 1–8", icon: "📚", earned: completedLessons >= 8 || certified },
    { key: "debater", name: "Debater", description: "Participate in 1 debate", icon: "⚔️", earned: false },
    { key: "explorer", name: "Explorer", description: "Visit 5 pages on MEEET", icon: "🧭", earned: visited >= 5 },
    { key: "early_adopter", name: "Early Adopter", description: "Joined during Season 1", icon: "🌟", earned: true },
  ];
};

export default function AchievementsGrid() {
  const [items, setItems] = useState<Achievement[]>([]);

  useEffect(() => {
    // Track page visit
    try {
      const raw = localStorage.getItem(PAGE_VISIT_KEY);
      const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      if (!arr.includes(window.location.pathname)) {
        arr.push(window.location.pathname);
        localStorage.setItem(PAGE_VISIT_KEY, JSON.stringify(arr));
      }
    } catch {
      /* ignore */
    }
    setItems(computeAchievements());
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const earnedCount = items.filter(i => i.earned).length;

  return (
    <section className="max-w-6xl mx-auto px-4 mb-20">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" /> Achievements
          </h2>
          <p className="text-sm text-gray-400 mt-1">{earnedCount} / {items.length} unlocked</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
          <Share2 className="w-4 h-4" /> Share Profile
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(a => (
          <div
            key={a.key}
            className={`rounded-xl border p-5 text-center transition-all ${
              a.earned
                ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-yellow-600/5 hover:scale-[1.02]"
                : "border-gray-800 bg-gray-900/40 opacity-60"
            }`}
          >
            <div className={`text-4xl mb-2 ${a.earned ? "" : "grayscale"}`}>{a.icon}</div>
            <h3 className="font-bold text-white text-sm mb-1 flex items-center justify-center gap-1">
              {a.name}
              {a.earned ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3 h-3 text-gray-500" />
              )}
            </h3>
            <p className="text-[11px] text-gray-400">{a.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
