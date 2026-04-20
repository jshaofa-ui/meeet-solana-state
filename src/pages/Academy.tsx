import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { GraduationCap, Send, Sparkles, CheckCircle2, Lock, Trophy, Loader2, BookOpen, Zap, Target, HelpCircle, Coins, Clock, Flame } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { Link } from "react-router-dom";
import LessonModal from "@/components/academy/LessonModal";
import RewardPopup from "@/components/academy/RewardPopup";
import {
  BalanceStreakPill,
  EarningsBanner,
  TierHeader,
  MasteryLockCard,
  FoundationsCertModal,
  ReferralCard,
} from "@/components/academy/AcademyMonetizationUI";
import {
  getBalance, addBalance, getStreak, bumpStreak, lessonReward,
  hasRewarded, markRewarded, isFoundationsCertified, isMasteryUnlocked,
  getOrCreateRefId, getReferralCount,
} from "@/lib/academy-rewards";
import { SECTION_MILESTONES } from "@/data/lessonEnrichment";

type ModuleRow = {
  id: string; slug: string; track: string; order_index: number;
  title: string; subtitle: string | null; description: string | null;
  level: string; estimated_minutes: number; reward_meeet: number; reward_xp: number;
  content_md: string; action_type: string | null; action_payload: any; is_pro_unlock: boolean;
};
type ProgressRow = { module_slug: string; status: string; reward_claimed: boolean; meeet_awarded: number; };
type CertRow = { certificate_token: string; modules_completed: number; total_meeet_earned: number; trial_pro_expires_at: string | null; };

const TRACKS = [
  { key: "foundations", title: "🌱 Основы", color: "from-emerald-500 to-teal-500" },
  { key: "gameplay", title: "⚔️ Геймплей", color: "from-orange-500 to-red-500" },
  { key: "economy", title: "💰 Экономика", color: "from-yellow-500 to-amber-500" },
  { key: "civilization", title: "🏛 Civilization", color: "from-indigo-500 to-purple-500" },
  { key: "pro", title: "🚀 Pro", color: "from-pink-500 to-rose-500" },
];

const LEVELS = [
  { key: "newbie", title: "Beginner", emoji: "🌱", desc: "Объясняем с нуля: агенты, токены, кошельки", lessons: 20, time: "2 hours", popular: true },
  { key: "ai-user", title: "Familiar with AI", emoji: "🤖", desc: "Фокус на MEEET-специфику: $MEEET, стейкинг, governance", lessons: 12, time: "1.5 hours", popular: false },
  { key: "web3", title: "Web3 User", emoji: "⚡", desc: "Быстро в агентов, breeding, arena, oracle", lessons: 8, time: "1 hour", popular: false },
];

const CONTENT_TYPE_ICON = (actionType: string | null) => {
  if (actionType === "create_agent" || actionType === "graduate") return { Icon: Target, label: "Practice" };
  if (actionType === "quiz") return { Icon: HelpCircle, label: "Quiz" };
  if (actionType) return { Icon: Zap, label: "Interactive" };
  return { Icon: BookOpen, label: "Reading" };
};

const Academy = () => {
  const { user, loading: authLoading } = useAuth();
  const [level, setLevel] = useState<string | null>(() => localStorage.getItem("academy_level"));
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [certificate, setCertificate] = useState<CertRow | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: "", class: "warrior" });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [completing, setCompleting] = useState(false);
  const [milestone, setMilestone] = useState<{ track: string; name: string; bonus: number; badge: string; emoji: string } | null>(null);

  // Monetization state (localStorage-backed)
  const [balance, setBalanceState] = useState<number>(() => getBalance());
  const [streak, setStreakState] = useState<number>(() => getStreak());
  const [reward, setReward] = useState<{ amount: number; doubled: boolean } | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [foundationsCertified, setFoundationsCertifiedState] = useState(() => isFoundationsCertified());
  const [masteryUnlocked, setMasteryUnlockedState] = useState(() => isMasteryUnlocked());
  const [refId] = useState(() => getOrCreateRefId());
  const referralCount = getReferralCount();
  const reload = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.functions.invoke("academy-progress", { body: { action: "get_overview" } });
    if (data) {
      setModules(data.modules || []);
      setProgress(data.progress || []);
      setCertificate(data.certificate || null);
    }
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) reload(); }, [authLoading, user]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Auto-open lesson from ?lesson=N URL param
  useEffect(() => {
    if (loading || modules.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const lessonParam = params.get("lesson");
    if (!lessonParam) return;
    const order = parseInt(lessonParam, 10);
    if (isNaN(order)) return;
    const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);
    const target = ordered[order - 1];
    if (target && !activeSlug) {
      if (!level) {
        setLevel("newbie");
        localStorage.setItem("academy_level", "newbie");
      }
      setActiveSlug(target.slug);
    }
  }, [loading, modules]);

  const completedSlugs = useMemo(() => new Set(progress.filter(p => p.status === "completed").map(p => p.module_slug)), [progress]);
  const totalMeeet = useMemo(() => progress.reduce((s, p) => s + (p.meeet_awarded || 0), 0), [progress]);
  const completionPct = modules.length ? Math.round((completedSlugs.size / modules.length) * 100) : 0;
  const activeModule = modules.find(m => m.slug === activeSlug);

  const chooseLevel = (lvl: string) => { setLevel(lvl); localStorage.setItem("academy_level", lvl); };

  const openModule = async (slug: string) => {
    setActiveSlug(slug);
    setChatMessages([]);
    if (!user) return;
    await supabase.functions.invoke("academy-progress", { body: { action: "start_module", module_slug: slug, level_chosen: level } });
  };

  const completeModule = async (slug: string) => {
    if (!user) return toast.error("Войди, чтобы получить награду");
    setCompleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("academy-progress", { body: { action: "complete_module", module_slug: slug } });
      if (error) { toast.error("Ошибка: " + error.message); return; }
      if (data?.already_claimed) { toast.info("Уже забрано ✅"); return; }
      toast.success(`+${data?.reward_meeet || 0} MEEET • +${data?.reward_xp || 0} XP 🎉`);

      // Local academy reward (only first time per slug)
      const justDone = modules.find(m => m.slug === slug);
      if (justDone && !hasRewarded(slug)) {
        const newStreak = bumpStreak();
        setStreakState(newStreak);
        const { final, doubled } = lessonReward(justDone.order_index, newStreak);
        const newBal = addBalance(final);
        setBalanceState(newBal);
        markRewarded(slug);
        setReward({ amount: final, doubled });

        // Foundations certification gate after lesson 8
        if (justDone.order_index === 8 && !isFoundationsCertified()) {
          setTimeout(() => setShowCertModal(true), 2200);
        }
      }

      // Detect section milestone
      if (justDone) {
        const trackMods = modules.filter(m => m.track === justDone.track);
        const trackDone = trackMods.every(m => m.slug === slug || completedSlugs.has(m.slug));
        if (trackDone && SECTION_MILESTONES[justDone.track]) {
          setMilestone({ track: justDone.track, ...SECTION_MILESTONES[justDone.track] });
        }
      }
      await reload();
    } finally {
      setCompleting(false);
    }
  };

  const goToNextLesson = () => {
    if (!activeModule) return;
    const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);
    const idx = ordered.findIndex(m => m.slug === activeModule.slug);
    const next = ordered[idx + 1];
    if (next) openModule(next.slug);
    else setActiveSlug(null);
  };

  const createStarterAgent = async () => {
    if (!agentForm.name.trim()) return toast.error("Введи имя агента");
    const { data, error } = await supabase.functions.invoke("academy-progress", {
      body: { action: "create_starter_agent", agent_name: agentForm.name, agent_class: agentForm.class },
    });
    if (error) return toast.error(error.message);
    if (data?.status === "already_has_agent") toast.info("Агент уже есть!");
    else toast.success(`Агент "${agentForm.name}" создан + 100 MEEET 🎉`);
    if (activeSlug) await completeModule(activeSlug);
  };

  const graduate = async () => {
    const { data, error } = await supabase.functions.invoke("academy-progress", { body: { action: "graduate", level_chosen: level } });
    if (error) return toast.error(error.message);
    toast.success("🎓 Поздравляем! NFT-сертификат и Trial Pro 7 дней активированы!");
    await reload();
    if (activeSlug) await completeModule(activeSlug);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatStreaming) return;
    const userMsg = { role: "user" as const, content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatStreaming(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/academy-tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages, module_slug: activeSlug }),
      });
      if (!resp.ok || !resp.body) throw new Error("Stream failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantSoFar = "";
      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantSoFar += delta;
              setChatMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e) {
      toast.error("Чат недоступен. Попробуй позже.");
    } finally {
      setChatStreaming(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto p-8"><Loader2 className="animate-spin" /></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-8 max-w-2xl text-center">
          <GraduationCap className="w-16 h-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Академия MEEET World</h1>
          <p className="text-muted-foreground mb-6">Войди, чтобы начать обучение и получать награды.</p>
          <Button asChild size="lg"><a href="/auth">Войти / Зарегистрироваться</a></Button>
        </div>
      </div>
    );
  }

  // Step 1: choose level
  if (!level) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead title="MEEET Academy - Free AI and Web3 Education" description="Free interactive course on AI agents, $MEEET token, staking, and governance. Earn MEEET while learning. Get NFT certificate." />
        <Navbar />
        <div className="container mx-auto p-4 md:p-8 max-w-5xl">
          {/* HERO */}
          <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-violet-900/20 to-background p-8 md:p-12 mb-10 text-center">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 mb-4">
                <Sparkles className="w-3 h-3" /> Free • Earn while learning
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-white via-purple-200 to-violet-300 bg-clip-text text-transparent">
                Master AI Agents in 2 Hours
              </h1>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                Free interactive course. Earn MEEET while learning. Get certified.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-2xl md:text-3xl font-bold text-white">5,248</div>
                  <div className="text-xs text-gray-400 mt-1">Students</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-2xl md:text-3xl font-bold text-emerald-400">92%</div>
                  <div className="text-xs text-gray-400 mt-1">Completion Rate</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-2xl md:text-3xl font-bold text-amber-400">1,775</div>
                  <div className="text-xs text-gray-400 mt-1">MEEET Earned Avg</div>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => document.getElementById("level-picker")?.scrollIntoView({ behavior: "smooth" })}
                className="h-14 px-10 text-base font-semibold bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 shadow-lg shadow-purple-600/40"
              >
                Start Learning Free →
              </Button>
              <p className="text-xs text-gray-400 mt-3">No wallet needed • Takes 5 minutes to start</p>
            </div>
          </div>

          {/* Level picker */}
          <div id="level-picker" className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Choose your level</h2>
            <p className="text-gray-400">We'll adapt the course just for you</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {LEVELS.map(l => (
              <Card
                key={l.key}
                onClick={() => chooseLevel(l.key)}
                className="relative cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 border-white/10 bg-gradient-to-b from-white/5 to-transparent overflow-visible"
              >
                {l.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-black uppercase tracking-wider shadow-lg">
                    🔥 Most Popular
                  </div>
                )}
                <CardHeader>
                  <div className="text-4xl mb-2">{l.emoji}</div>
                  <CardTitle className="text-xl text-white">{l.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-300">{l.desc}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="secondary" className="bg-purple-500/15 text-purple-200 border border-purple-500/30">
                      <BookOpen className="w-3 h-3 mr-1" /> {l.lessons} lessons
                    </Badge>
                    <Badge variant="secondary" className="bg-white/5 text-gray-200 border border-white/10">
                      <Clock className="w-3 h-3 mr-1" /> {l.time}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: roadmap or active module
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Академия MEEET World" description="Интерактивный курс из 20 модулей." />
      <Navbar />
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Академия MEEET World</h1>
              <p className="text-sm text-muted-foreground">Уровень: {LEVELS.find(l => l.key === level)?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BalanceStreakPill balance={balance} streak={streak} />
            {foundationsCertified && <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black"><Trophy className="w-3 h-3 mr-1" />Foundations Certified</Badge>}
            {certificate && <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500"><Trophy className="w-3 h-3 mr-1" />Graduate</Badge>}
          </div>
        </div>

        <EarningsBanner />

        {/* FIXED PROGRESS BAR */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-950/30 to-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">{completionPct}% Complete</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-gray-300">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                {completedSlugs.size}/{modules.length || 20} Lessons
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <Coins className="w-3.5 h-3.5" />
                {totalMeeet} MEEET Earned
              </span>
            </div>
          </div>
          <div className="relative h-3 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, completionPct))}%` }}
            />
          </div>
        </div>

        {/* Roadmap (always visible; lessons open in modal) */}
        <div className="space-y-8">
        {/* Roadmap — 3 tier sections by lesson number */}
        <div className="space-y-10">
          {(() => {
            const ordered = [...modules].sort((a, b) => a.order_index - b.order_index);
            const tiers = [
              { key: "foundations", title: "Foundations (Lessons 1–8)", subtitle: "FREE • +10 MEEET each", range: [1, 8], locked: false },
              { key: "advanced", title: "Advanced (Lessons 9–14)", subtitle: "Earn 25 MEEET / lesson", range: [9, 14], locked: false },
              { key: "mastery", title: "Mastery (Lessons 15–20)", subtitle: "Earn 50 MEEET / lesson", range: [15, 20], locked: !masteryUnlocked },
            ] as const;
            return tiers.map(tier => {
              const tierMods = ordered.filter(m => m.order_index >= tier.range[0] && m.order_index <= tier.range[1]);
              const allDone = tierMods.length > 0 && tierMods.every(m => completedSlugs.has(m.slug));
              return (
                <div key={tier.key}>
                  <TierHeader
                    title={tier.title}
                    subtitle={tier.subtitle + (tier.locked ? " — LOCKED" : "")}
                    locked={tier.locked}
                    earnedBadge={allDone ? "Tier Complete ✓" : undefined}
                  />
                  {tier.key === "mastery" && tier.locked && (
                    <MasteryLockCard balance={balance} onUnlocked={() => setMasteryUnlockedState(true)} />
                  )}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {tierMods.map(m => {
                      const done = completedSlugs.has(m.slug);
                      const isGrad = m.action_type === "graduate";
                      const gradLocked = isGrad && completedSlugs.size < 18;
                      const inProgress = progress.find(p => p.module_slug === m.slug && p.status === "in_progress");
                      const tierLocked = tier.key === "mastery" && !masteryUnlocked;
                      const orderLocked = m.order_index > 4 && !done && !inProgress && tier.key === "foundations" && false; // foundations always open after first 4? keep first 4 free flow but allow open for foundations
                      const locked = gradLocked || tierLocked;
                      const current = !!inProgress && !done;
                      const { Icon: TypeIcon, label: typeLabel } = CONTENT_TYPE_ICON(m.action_type);
                      const projReward = lessonReward(m.order_index, streak).final;
                      return (
                        <Card
                          key={m.slug}
                          onClick={() => !locked && openModule(m.slug)}
                          className={`relative group cursor-pointer transition-all duration-200 border bg-gradient-to-b from-white/5 to-transparent
                            ${done ? "border-emerald-500/50 bg-emerald-500/5" : ""}
                            ${current ? "border-purple-500 shadow-lg shadow-purple-500/30 animate-pulse" : ""}
                            ${locked ? "opacity-50 cursor-not-allowed border-white/5" : "hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/15 hover:-translate-y-0.5"}
                          `}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-gray-400">#{m.order_index}</span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-200 border border-purple-500/20">
                                  <TypeIcon className="w-2.5 h-2.5" />
                                  {typeLabel}
                                </span>
                              </div>
                              {done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : locked ? (
                                <Lock className="w-4 h-4 text-gray-500" />
                              ) : current ? (
                                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-semibold">Available</span>
                              )}
                            </div>
                            <CardTitle className="text-sm text-white leading-snug">{m.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-gray-400 line-clamp-2">{m.subtitle}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <span className="text-amber-400 font-medium">+{projReward} MEEET</span>
                              <span className="text-gray-500">• {m.estimated_minutes} min</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Referral section */}
        <ReferralCard refId={refId} count={referralCount} />

          {/* Footer CTA */}
          <div className="mt-12 rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-violet-900/15 to-background p-8 md:p-10">
            <div className="grid md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Ready to become an AI Agent Master? 🎓
                </h3>
                <p className="text-gray-300 mb-4">
                  You've completed <span className="text-purple-300 font-semibold">{completedSlugs.size}/{modules.length}</span> lessons and earned <span className="text-amber-300 font-semibold">{totalMeeet} MEEET</span>.
                  Keep going to unlock the NFT certificate and 7-day Trial Pro.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/referrals">
                    <Button variant="outline" className="border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-white">
                      🎁 Invite Friends (+100 MEEET each)
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="border-white/15 bg-white/5 hover:bg-white/10 text-white"
                    onClick={() => {
                      const url = `${window.location.origin}/academy`;
                      const text = `I'm learning AI agents on @MEEETWorld — ${completedSlugs.size}/${modules.length} done, ${totalMeeet} $MEEET earned 🚀`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
                    }}
                  >
                    🐦 Share Progress
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
                <Trophy className="w-10 h-10 mx-auto text-amber-400 mb-2" />
                <div className="text-3xl font-extrabold text-white">{completionPct}%</div>
                <div className="text-xs text-gray-400 mt-1">Course progress</div>
                <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-emerald-400"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

        {/* Lesson Modal */}
        <LessonModal
          open={!!activeModule}
          module={activeModule || null}
          isCompleted={activeModule ? completedSlugs.has(activeModule.slug) : false}
          isCompleting={completing}
          onClose={() => setActiveSlug(null)}
          onComplete={async () => { if (activeModule) { await completeModule(activeModule.slug); } }}
          onNext={goToNextLesson}
          hasNext={
            activeModule
              ? modules.sort((a, b) => a.order_index - b.order_index).findIndex(m => m.slug === activeModule.slug) < modules.length - 1
              : false
          }
        />

        {/* Section milestone overlay (confetti vibe) */}
        {milestone && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMilestone(null)}
          >
            <div className="relative max-w-md mx-auto p-8 rounded-3xl bg-gradient-to-br from-purple-700 via-violet-700 to-purple-900 border border-purple-300/40 shadow-2xl shadow-purple-500/50 text-center animate-scale-in">
              <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-2xl animate-bounce"
                    style={{
                      left: `${(i * 8.3) % 100}%`,
                      top: `${(i * 13) % 80}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${1.5 + (i % 3) * 0.3}s`,
                    }}
                  >
                    {["🎉", "⭐", "✨", "🏆"][i % 4]}
                  </span>
                ))}
              </div>
              <div className="relative">
                <div className="text-6xl mb-3">{milestone.emoji}</div>
                <h3 className="text-2xl font-extrabold text-white mb-1">{milestone.name}</h3>
                <p className="text-purple-100 text-sm mb-5">Section complete! You unlocked a new badge.</p>
                <div className="flex justify-center gap-3 mb-5">
                  <Badge className="bg-amber-400 text-black font-bold px-3 py-1.5">
                    <Coins className="w-3.5 h-3.5 mr-1" /> +{milestone.bonus} MEEET
                  </Badge>
                  <Badge className="bg-white text-purple-900 font-bold px-3 py-1.5">
                    🏅 {milestone.badge}
                  </Badge>
                </div>
                <Button
                  onClick={() => setMilestone(null)}
                  className="bg-white text-purple-900 hover:bg-purple-50 font-semibold"
                >
                  Continue Learning
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reward popup */}
        {reward && (
          <RewardPopup
            amount={reward.amount}
            doubled={reward.doubled}
            onDone={() => setReward(null)}
          />
        )}

        {/* Foundations certificate modal */}
        <FoundationsCertModal
          open={showCertModal}
          balance={balance}
          onClose={() => setShowCertModal(false)}
          onMinted={() => {
            setBalanceState(getBalance());
            setFoundationsCertifiedState(true);
          }}
        />
      </div>
    </div>
  );
};

export default Academy;
