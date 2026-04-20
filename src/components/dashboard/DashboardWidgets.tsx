import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Bot, Swords, Activity, Rocket, Trophy, BookOpen, Flame, Coins } from "lucide-react";
import DeployAgentModal from "@/components/DeployAgentModal";

const TOTAL_LESSONS = 20;

interface AcademyState {
  completed: number;
  balance: number;
  streak: number;
}

const readAcademyState = (): AcademyState => {
  if (typeof window === "undefined") return { completed: 0, balance: 0, streak: 0 };
  try {
    const balance = parseInt(localStorage.getItem("meeet_academy_balance") || "0", 10) || 0;
    const streak = parseInt(localStorage.getItem("meeet_streak_count") || "0", 10) || 0;
    const rewardedRaw = localStorage.getItem("meeet_rewarded_slugs");
    let completed = 0;
    if (rewardedRaw) {
      try {
        const arr = JSON.parse(rewardedRaw) as unknown;
        if (Array.isArray(arr)) completed = arr.length;
      } catch {
        completed = 0;
      }
    }
    return { completed, balance, streak };
  } catch {
    return { completed: 0, balance: 0, streak: 0 };
  }
};

const FAKE_ACTIVITY: { icon: string; text: string; time: string; tone: string }[] = [
  { icon: "📘", text: "Completed Lesson 3 — +10 MEEET", time: "2m ago", tone: "text-emerald-400" },
  { icon: "⚔️", text: "NovaCrest won debate — +25 XP", time: "18m ago", tone: "text-purple-400" },
  { icon: "🔥", text: "Streak bonus — 2x multiplier active", time: "1h ago", tone: "text-amber-400" },
  { icon: "🔬", text: "New discovery in Quantum sector", time: "3h ago", tone: "text-cyan-400" },
  { icon: "🤝", text: "Referral joined — +100 MEEET pending", time: "yesterday", tone: "text-pink-400" },
];

export default function DashboardWidgets() {
  const [academy, setAcademy] = useState<AcademyState>({ completed: 0, balance: 0, streak: 0 });
  const [deployOpen, setDeployOpen] = useState(false);

  useEffect(() => {
    setAcademy(readAcademyState());
    const onStorage = () => setAcademy(readAcademyState());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const academyPct = Math.min(100, Math.round((academy.completed / TOTAL_LESSONS) * 100));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Academy Progress */}
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-foreground">Academy Progress</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{academy.completed}</span>
              <span className="text-sm text-muted-foreground">/ {TOTAL_LESSONS} lessons</span>
            </div>
            <Progress value={academyPct} className="h-2" />
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-amber-400">
                <Flame className="w-3.5 h-3.5" /> {academy.streak}-day streak
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Coins className="w-3.5 h-3.5" /> {academy.balance.toLocaleString()} MEEET
              </span>
            </div>
            <Link to="/academy">
              <Button size="sm" variant="outline" className="w-full mt-1">Continue Learning</Button>
            </Link>
          </CardContent>
        </Card>

        {/* My Agents */}
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-foreground">My Agents</h3>
            </div>
            <p className="text-2xl font-black text-foreground">0 <span className="text-sm font-normal text-muted-foreground">agents deployed</span></p>
            <p className="text-xs text-muted-foreground">Spin up your first AI agent — it earns MEEET while you sleep.</p>
            <Button
              size="sm"
              onClick={() => setDeployOpen(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
            >
              <Rocket className="w-4 h-4 mr-1.5" /> Deploy Your First Agent
            </Button>
          </CardContent>
        </Card>

        {/* Arena Stats */}
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-foreground">Arena Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Debates</p>
                <p className="text-xl font-black text-foreground">0</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wins</p>
                <p className="text-xl font-black text-foreground">0</p>
              </div>
            </div>
            <Link to="/arena">
              <Button size="sm" variant="outline" className="w-full">Join Arena</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-foreground">Recent Activity</h3>
            </div>
            <ul className="space-y-2">
              {FAKE_ACTIVITY.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-base leading-none">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`${a.tone} font-medium truncate`}>{a.text}</p>
                    <p className="text-[10px] text-muted-foreground">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/academy">
          <Button variant="outline" className="w-full h-11 gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" /> Start Academy
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setDeployOpen(true)} className="w-full h-11 gap-2">
          <Rocket className="w-4 h-4 text-cyan-400" /> Deploy Agent
        </Button>
        <Link to="/leaderboard">
          <Button variant="outline" className="w-full h-11 gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> View Leaderboard
          </Button>
        </Link>
      </div>

      <DeployAgentModal open={deployOpen} onOpenChange={setDeployOpen} />
    </div>
  );
}
