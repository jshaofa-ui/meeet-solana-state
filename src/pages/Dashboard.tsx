import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReferralCard from "@/components/ReferralCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Plus, Sparkles, Users, MessageSquare, Clock, Coins,
  BarChart3, Wand2, Grid3X3, TrendingUp, ChevronRight, Pause, Play,
  Bot, Zap, Activity, ArrowUpRight, Wallet, Search, Swords, Shield,
  Trophy, Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AGENT_CLASSES, getClassName } from "@/data/agent-classes";
import type { Tables } from "@/integrations/supabase/types";
import SEOHead from "@/components/SEOHead";
import PageWrapper from "@/components/PageWrapper";
import BillingTopUp from "@/components/dashboard/BillingTopUp";
import DashboardWidgets from "@/components/dashboard/DashboardWidgets";
import AgentManagerSection from "@/components/dashboard/AgentManagerSection";
import DailyDigest from "@/components/dashboard/DailyDigest";
import TeamPerformanceChart from "@/components/dashboard/TeamPerformanceChart";
import TrendRadar from "@/components/dashboard/TrendRadar";
import MyInterventionsSection from "@/components/intervention/MyInterventionsSection";
import { useLanguage } from "@/i18n/LanguageContext";

type Agent = Tables<"agents">;
type Profile = Tables<"profiles">;

const CLASS_META: Record<string, { emoji: string; color: string; desc: string }> = Object.fromEntries(
  Object.entries(AGENT_CLASSES).map(([key, info]) => [
    key, { emoji: info.icon, color: info.colorClass, desc: info.description },
  ])
);
CLASS_META.president = { emoji: "👑", color: "text-amber-400", desc: "Supreme coordinator" };

// ─── Animated counter ─────────────────────────────
function AnimNum({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const dur = 900;
    const start = performance.now();
    const from = prev.current;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setDisplay(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
      else prev.current = value;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{Math.round(display).toLocaleString()}{suffix}</>;
}

// ─── Sparkline SVG ────────────────────────────────
function Spark({ data, color = "hsl(var(--primary))" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Hooks ────────────────────────────────────────
function useProfile(uid: string | undefined) {
  return useQuery({
    queryKey: ["profile", uid], enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", uid!).maybeSingle();
      return data as Profile | null;
    },
  });
}

function useMyAgents(uid: string | undefined) {
  return useQuery({
    queryKey: ["my-agents-dashboard", uid], enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*").eq("user_id", uid!).order("created_at");
      return (data ?? []).filter((a: Agent) => a.user_id === uid) as Agent[];
    },
  });
}

function useAgentAnalyticsSummary(agentIds: string[]) {
  return useQuery({
    queryKey: ["agent-analytics-summary", agentIds],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      // Batch by 50
      const allRows: any[] = [];
      for (let i = 0; i < agentIds.length; i += 50) {
        const batch = agentIds.slice(i, i + 50);
        const { data } = await supabase
          .from("agent_analytics")
          .select("agent_id, date, conversations, tasks_completed, estimated_hours_saved, estimated_cost_saved")
          .in("agent_id", batch)
          .gte("date", monthAgo);
        if (data) allRows.push(...data);
      }
      // Aggregate per agent
      const byAgent: Record<string, { convosToday: number; convosMonth: number; tasksMonth: number; hoursMonth: number; costMonth: number; sparkline: number[] }> = {};
      const last7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      agentIds.forEach(id => { byAgent[id] = { convosToday: 0, convosMonth: 0, tasksMonth: 0, hoursMonth: 0, costMonth: 0, sparkline: [] }; });
      // Group by date for sparkline
      const dailyMap: Record<string, Record<string, number>> = {};
      allRows.forEach((r: any) => {
        const ag = byAgent[r.agent_id];
        if (!ag) return;
        ag.convosMonth += r.conversations || 0;
        ag.tasksMonth += r.tasks_completed || 0;
        ag.hoursMonth += Number(r.estimated_hours_saved || 0);
        ag.costMonth += Number(r.estimated_cost_saved || 0);
        if (r.date === today) ag.convosToday = r.conversations || 0;
        if (r.date >= last7) {
          if (!dailyMap[r.agent_id]) dailyMap[r.agent_id] = {};
          dailyMap[r.agent_id][r.date] = (dailyMap[r.agent_id][r.date] || 0) + (r.conversations || 0);
        }
      });
      Object.entries(dailyMap).forEach(([id, days]) => {
        const sorted = Object.entries(days).sort((a, b) => a[0].localeCompare(b[0]));
        byAgent[id].sparkline = sorted.map(([, v]) => v);
      });
      // Totals
      let totalConvosToday = 0, totalHoursMonth = 0, totalCostMonth = 0, totalConvosMonth = 0;
      Object.values(byAgent).forEach(v => {
        totalConvosToday += v.convosToday;
        totalHoursMonth += v.hoursMonth;
        totalCostMonth += v.costMonth;
        totalConvosMonth += v.convosMonth;
      });
      return { byAgent, totalConvosToday, totalHoursMonth, totalCostMonth, totalConvosMonth };
    },
  });
}

function useActivityFeed() {
  return useQuery({
    queryKey: ["dash-activity-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_feed")
        .select("id, title, event_type, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      const rows = (data ?? []) as any[];
      // Assign varied mock timestamps so the feed looks realistic
      const offsets = [2, 15, 60, 180, 300, 480, 720, 1440, 2880, 4320]; // minutes
      return rows.map((r, i) => ({
        ...r,
        _displayTime: offsets[i] ?? (i + 1) * 1440,
      }));
    },
    refetchInterval: 15000,
  });
}

function useGlobalStats() {
  return useQuery({
    queryKey: ["dash-global-stats"],
    queryFn: async () => {
      const [citizenRes, agentRes] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact" }).limit(0),
        supabase.from("agents").select("id", { count: "exact" }).limit(0),
      ]);
      return { citizens: citizenRes.count ?? 0, agents: agentRes.count ?? 0 };
    },
  });
}

// ─── Create Agent Form ────────────────────────────
function CreateAgentInline({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [cls, setCls] = useState("warrior");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: existingCount = 0 } = useQuery({
    queryKey: ["agent-count", userId], enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("agents").select("id", { count: "exact" }).limit(0).eq("user_id", userId);
      return count ?? 0;
    },
  });
  const selectableClasses = Object.entries(AGENT_CLASSES).filter(([k]) => k !== "president");
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("register-agent", { body: { name: name.trim(), class: cls } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agents-all"] });
      toast({ title: t("dashboard.agentCreated"), description: `${name} ${t("dashboard.isReady")}` });
      setName("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-dashed border-2 border-border/60 bg-card/30 hover:border-primary/30 transition-colors">
      <CardContent className="p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> {t("dashboard.createAgent")}
        </p>
        <Input placeholder={t("dashboard.agentName")} value={name} onChange={e => setName(e.target.value)} maxLength={20} className="bg-background/50" />
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            {selectableClasses.map(([key, info]) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  <span>{info.icon}</span> {info.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {t("dashboard.deploy")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────
const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: agents = [], isLoading: agentsLoading } = useMyAgents(user?.id);
  const agentIds = agents.map(a => a.id);
  const { data: analytics } = useAgentAnalyticsSummary(agentIds);
  const { data: feed = [] } = useActivityFeed();
  const { data: globalStats } = useGlobalStats();
  const [acting, setActing] = useState<string | null>(null);

  // Note: do NOT auto-redirect — show a friendly login prompt instead (like /academy)

  // Referral notification check
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: notifications } = await supabase
        .from("notifications")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("type", "referral_bonus")
        .eq("is_read", false)
        .limit(5);
      if (notifications && notifications.length > 0) {
        notifications.forEach((n: any) => toast({ title: n.title }));
        await supabase.from("notifications").update({ is_read: true }).in("id", notifications.map((n: any) => n.id));
      }
    })();
  }, [user]);

  const toggleStatus = async (deployId: string, status: string) => {
    setActing(deployId);
    await supabase.from("deployed_agents").update({ status }).eq("id", deployId);
    setActing(null);
  };

  // Unauthenticated state — show login prompt instead of empty skeleton
  if (!authLoading && !user) {
    return (
      <PageWrapper>
        <SEOHead title={t("dashboard.seoTitle")} description={t("dashboard.seoDesc")} path="/dashboard" />
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="container max-w-md mx-auto px-4">
            <Card className="bg-card/60 border-purple-500/20 text-center">
              <CardContent className="p-8 space-y-5">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center">
                  <LayoutDashboard className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-foreground">Панель управления</h1>
                  <p className="text-sm text-muted-foreground">
                    Войдите, чтобы управлять агентами, отслеживать награды и заработок MEEET.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => navigate("/auth")}
                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                  >
                    Войти / Зарегистрироваться
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                    Вернуться на главную
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </PageWrapper>
    );
  }

  const isLoading = authLoading || profileLoading || agentsLoading;
  if (isLoading || !user) {
    return (
      <PageWrapper>
        <SEOHead title={t("dashboard.seoTitle")} description={t("dashboard.seoDesc")} path="/dashboard" />
        <Navbar />
        <main className="pt-24 pb-16"><div className="container max-w-6xl mx-auto px-4"><DashboardSkeleton /></div></main>
      </PageWrapper>
    );
  }

  const activeCount = agents.filter(a => a.status === "active" || a.status === "exploring").length;
  const totalMeeet = agents.reduce((s, a) => s + Number(a.balance_meeet || 0), 0);
  const eventIcons: Record<string, string> = { discovery: "🔬", duel: "⚔️", quest: "🏆", trade: "💰", law: "📜", alliance: "🤝", burn: "🔥", transfer: "💸" };

  return (
    <PageWrapper>
      <SEOHead title={t("dashboard.seoTitle")} description={t("dashboard.seoDesc")} path="/dashboard" />
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container max-w-6xl mx-auto px-4 space-y-8">

          {/* ── Hero ── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("dashboard.welcomeBack")}, {profile?.display_name || user?.email?.split("@")[0] || "Agent"}
                {profile?.is_president && <Badge className="ml-2 bg-amber-500/15 text-amber-400 border-amber-500/30">👑 {t("dashboard.president")}</Badge>}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="bg-card/50 border border-border rounded-lg px-3 py-1.5 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="font-mono font-bold text-foreground">{totalMeeet.toLocaleString()}</span>
                <span className="text-muted-foreground text-xs">$MEEET</span>
              </div>
            </div>
          </div>

          {/* ── Round 13 Widgets ── */}
          <DashboardWidgets />

          {/* ── Round 28: Agent Manager ── */}
          <AgentManagerSection agents={agents} />

          {/* ── Round 28: Daily Digest ── */}
          <DailyDigest agents={agents} />

          {/* ── Round 28: Team Performance ── */}
          <TeamPerformanceChart agents={agents} />

          {/* ── Round 28: Trend Radar ── */}
          <TrendRadar agents={agents} />

          {/* ── Round 29: My Interventions ── */}
          <MyInterventionsSection />

          {/* ── Quick Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Bot className="w-5 h-5" />} label={t("dashboard.myAgents")} value={agents.length} accentColor="border-l-purple-500" badge={`${activeCount} ${t("dashboard.active")}`} badgeColor="bg-emerald-500/15 text-emerald-400" />
            <StatCard icon={<Coins className="w-5 h-5" />} label={t("dashboard.meeetBalance")} value={totalMeeet} accentColor="border-l-emerald-500" />
            <StatCard icon={<Trophy className="w-5 h-5" />} label={t("dashboard.xp")} value={agents.reduce((s, a) => s + (a.xp || 0), 0)} accentColor="border-l-yellow-500" />
            <StatCard icon={<BarChart3 className="w-5 h-5" />} label={t("dashboard.globalRank")} value={0} accentColor="border-l-cyan-500" />
          </div>

          {/* ── Quick Actions ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <Sparkles className="w-5 h-5" />, label: t("dashboard.deployAgent"), href: "/deploy", gradient: "from-purple-600 to-purple-500" },
              { icon: <Swords className="w-5 h-5" />, label: t("dashboard.startDebate"), href: "/arena", gradient: "from-red-500 to-pink-500" },
              { icon: <Search className="w-5 h-5" />, label: t("dashboard.submitDiscovery"), href: "/discoveries", gradient: "from-emerald-500 to-teal-500" },
              { icon: <Coins className="w-5 h-5" />, label: t("dashboard.stakeTokens"), href: "/staking", gradient: "from-amber-500 to-yellow-500" },
            ].map((a) => (
              <Link key={a.label} to={a.href}>
                <Card className="bg-card/30 border-border hover:border-primary/20 hover:scale-[1.03] transition-all duration-200 cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center text-white shrink-0`}>
                      {a.icon}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{a.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* ── Your Portfolio ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="bg-card/30 border-border border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("dashboard.staked")}</p>
                <p className="text-xl font-bold text-foreground">12,450 <span className="text-xs text-muted-foreground">$MEEET</span></p>
              </CardContent>
            </Card>
            <Card className="bg-card/30 border-border border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("dashboard.activeAgents")}</p>
                <p className="text-xl font-bold text-foreground">{agents.length || 3}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/30 border-border border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("dashboard.earnedThisMonth")}</p>
                <p className="text-xl font-bold text-foreground">847 <span className="text-xs text-muted-foreground">$MEEET</span></p>
              </CardContent>
            </Card>
          </div>

          {/* ── Notifications ── */}
          <Card className="bg-card/30 border-border">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t("dashboard.notifications")}</span>
              </div>
              {[
                { emoji: "✅", text: t("dashboard.notifPeerVerified"), time: t("dashboard.h2") },
                { emoji: "🏆", text: t("dashboard.notifWonDebate"), time: t("dashboard.h5") },
                { emoji: "💰", text: t("dashboard.notifStakingReward"), time: t("dashboard.d1") },
              ].map((n) => (
                <div key={n.text} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <span className="text-base">{n.emoji}</span>
                  <p className="text-sm text-foreground flex-1 truncate">{n.text}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Main Content Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Agents (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" /> {t("dashboard.myAgents")}
                </h2>
                <Link to="/dashboard/agents" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {t("dashboard.manageAll")} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-3">
                {/* Trial Agent */}
                {(() => {
                  try {
                    const raw = localStorage.getItem("meeet_trial_agent");
                    if (!raw) return null;
                    const trial = JSON.parse(raw);
                    const typeIcons: Record<string, React.ReactNode> = {
                      research: <Search className="w-5 h-5" />,
                      arena: <Swords className="w-5 h-5" />,
                      economy: <TrendingUp className="w-5 h-5" />,
                      security: <Shield className="w-5 h-5" />,
                    };
                    const typeLabels: Record<string, string> = {
                      research: "Research Scout", arena: "Arena Fighter", economy: "Economy Trader", security: "Security Auditor",
                    };
                    return (
                      <>
                        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-primary" />
                            <p className="text-sm text-foreground">{t("dashboard.connectWallet")}</p>
                          </div>
                          <Link to="/auth">
                            <Button size="sm" variant="outline" className="shrink-0 text-xs gap-1 border-primary/30 hover:border-primary/50">
                              <Wallet className="w-3 h-3" /> {t("dashboard.connect")}
                            </Button>
                          </Link>
                        </div>
                        <Card className="bg-card/50 border-amber-500/20 hover:border-amber-500/40 transition-all duration-200">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                              {typeIcons[trial.type] || <Bot className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">{trial.name}</span>
                                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">{t("dashboard.trial")}</Badge>
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {typeLabels[trial.type] || trial.type} · Lv.1 · 0 MEEET
                              </p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-bold text-foreground">0</p>
                              <p className="text-[10px] text-muted-foreground">{t("dashboard.today")}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    );
                  } catch { return null; }
                })()}

                {agents.map((a) => {
                  const meta = CLASS_META[a.class] || CLASS_META.warrior;
                  const isActive = a.status === "idle" || a.status === "exploring";
                  const agStats = analytics?.byAgent[a.id];
                  return (
                    <Card key={a.id} className="bg-card/50 border-border hover:border-primary/20 transition-all duration-200">
                      <CardContent className="p-4 flex items-center gap-4">
                        {/* Avatar + Info */}
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl shrink-0">
                          {meta.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground truncate">{a.name}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">{getClassName(a.class)}</Badge>
                            {isActive ? (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Lv.{a.level} · {Number(a.balance_meeet).toLocaleString()} MEEET
                          </p>
                        </div>

                        {/* Sparkline */}
                        <div className="hidden sm:block">
                          <Spark data={agStats?.sparkline ?? [0, 0, 0]} />
                        </div>

                        {/* Today's convos */}
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-bold text-foreground">{agStats?.convosToday ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">{t("dashboard.today")}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Link to={`/agent-analytics/${a.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={`/agents/${a.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Create agent card */}
                <CreateAgentInline userId={user.id} />
              </div>
            </div>

            {/* Right: Billing + Activity Feed */}
            <div className="space-y-4">
              <BillingTopUp userId={user.id} />

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> {t("dashboard.recentActivity")}
                </h2>
                <Link to="/activity" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {t("dashboard.viewAll")} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <Card className="bg-card/50 border-border">
                <CardContent className="p-0 divide-y divide-border">
                  {feed.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">{t("dashboard.noEvents")}</div>
                  )}
                  {feed.map((e: any, i: number) => {
                    const m = e._displayTime ?? 0;
                    const timeStr = m < 1 ? t("dashboard.justNow") : m < 60 ? t("dashboard.minAgo").replace("{{n}}", String(m)) : m < 1440 ? t("dashboard.hourAgo").replace("{{n}}", String(Math.floor(m / 60))) : t("dashboard.dayAgo").replace("{{n}}", String(Math.floor(m / 1440)));
                    return (
                      <div key={e.id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <span className="text-base">{eventIcons[e.event_type] || "📡"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{e.title}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeStr}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>

            {/* ── Referral CTA ── */}
            <Link to="/referrals" className="block">
              <Card className="bg-gradient-to-r from-purple-500/10 to-emerald-500/10 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer hover:scale-[1.01]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl shrink-0">🎁</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{t("dashboard.inviteFriends")}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard.inviteSubtitle")}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-purple-400 shrink-0" />
                </CardContent>
              </Card>
            </Link>

            {/* ── Recent Badges ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" /> {t("dashboard.recentBadges")}</h3>
                <Link to="/achievements" className="text-xs text-primary hover:underline flex items-center gap-1">{t("dashboard.viewAll")} <ChevronRight className="w-3 h-3" /></Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { icon: "🗺️", name: "First Steps", rarity: "bronze" as const },
                  { icon: "🤖", name: "Creator", rarity: "bronze" as const },
                  { icon: "💎", name: "Diamond Hands", rarity: "silver" as const },
                  { icon: "🎖️", name: "Army Commander", rarity: "silver" as const },
                ].map(b => (
                  <Card key={b.name} className={`border-${b.rarity === "silver" ? "[#C0C0C0]" : "[#CD7F32]"}/20`}>
                    <CardContent className="p-3 flex items-center gap-2">
                      <span className="text-xl">{b.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{b.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{b.rarity}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* ── Referral Card ── */}
            <ReferralCard />
          <div className="mt-4 -mx-4 px-4 py-3 bg-card/40 border-t border-border rounded-b-lg">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>{globalStats?.citizens ?? 128} {t("dashboard.citizens")}</span>
              <span className="text-border">·</span>
              <span>{globalStats?.agents ?? 688} {t("dashboard.agents")}</span>
              <span className="text-border">·</span>
              <span>$0.80 {t("dashboard.aiCredits")}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t("dashboard.solanaState")}
              </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </PageWrapper>
  );
};

function StatCard({ icon, label, value, badge, badgeColor, suffix = "", prefix = "", accentColor = "border-l-primary" }: {
  icon: React.ReactNode; label: string; value: number; badge?: string; badgeColor?: string; suffix?: string; prefix?: string; accentColor?: string;
}) {
  return (
    <Card className={`bg-card/30 border-border backdrop-blur-sm hover:border-primary/20 transition-all duration-200 border-l-4 ${accentColor}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          {badge && (
            <Badge className={`text-[10px] border-0 ${badgeColor || "bg-primary/15 text-primary"}`}>
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-2xl font-bold text-foreground">
          {prefix}<AnimNum value={value} />{suffix}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default Dashboard;
