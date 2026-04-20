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
      // Detect section milestone: was this the last unfinished module of its track?
      const justDone = modules.find(m => m.slug === slug);
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
        <SEOHead title="Академия MEEET World — Интерактивный курс" description="Пройди 20 модулей, получи MEEET, NFT-сертификат и Trial Pro." />
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
            {certificate && <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500"><Trophy className="w-3 h-3 mr-1" />Graduate</Badge>}
          </div>
        </div>

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

        {!activeModule ? (
          // Roadmap
          <div className="space-y-8">
            {TRACKS.map(track => {
              const trackModules = modules.filter(m => m.track === track.key);
              return (
                <div key={track.key}>
                  <h2 className={`text-xl font-bold mb-3 bg-gradient-to-r ${track.color} bg-clip-text text-transparent`}>{track.title}</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {trackModules.map(m => {
                      const done = completedSlugs.has(m.slug);
                      const isGrad = m.action_type === "graduate";
                      const gradLocked = isGrad && completedSlugs.size < 18;
                      // First 4 lessons available, rest locked (unless already done or current)
                      const inProgress = progress.find(p => p.module_slug === m.slug && p.status === "in_progress");
                      const orderLocked = m.order_index > 4 && !done && !inProgress;
                      const locked = gradLocked || orderLocked;
                      const current = !!inProgress && !done;
                      const { Icon: TypeIcon, label: typeLabel } = CONTENT_TYPE_ICON(m.action_type);
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
                              <span className="text-amber-400 font-medium">+{m.reward_meeet} MEEET</span>
                              <span className="text-gray-500">• {m.estimated_minutes} мин</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Active module: split view
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Content */}
            <div className="lg:col-span-2 space-y-4">
              <Button variant="ghost" onClick={() => setActiveSlug(null)}>← К roadmap</Button>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{activeModule.track} • #{activeModule.order_index}</Badge>
                    <Badge>+{activeModule.reward_meeet} MEEET</Badge>
                  </div>
                  <CardTitle className="text-2xl">{activeModule.title}</CardTitle>
                  {activeModule.subtitle && <p className="text-muted-foreground">{activeModule.subtitle}</p>}
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeModule.content_md}</ReactMarkdown>
                  </div>

                  {/* Interactive actions */}
                  <div className="mt-6 pt-6 border-t">
                    {activeModule.action_type === "create_agent" && !completedSlugs.has(activeModule.slug) && (
                      <div className="space-y-3">
                        <h3 className="font-semibold">🤖 Создай своего агента</h3>
                        <Input placeholder="Имя агента" value={agentForm.name} onChange={e => setAgentForm({ ...agentForm, name: e.target.value })} />
                        <div className="flex flex-wrap gap-2">
                          {(activeModule.action_payload?.classes || []).map((c: string) => (
                            <Button key={c} variant={agentForm.class === c ? "default" : "outline"} size="sm" onClick={() => setAgentForm({ ...agentForm, class: c })}>{c}</Button>
                          ))}
                        </div>
                        <Button onClick={createStarterAgent} className="w-full"><Sparkles className="w-4 h-4 mr-2" />Создать + получить 100 MEEET</Button>
                      </div>
                    )}
                    {activeModule.action_type === "graduate" && (
                      <Button onClick={graduate} size="lg" className="w-full bg-gradient-to-r from-yellow-500 to-amber-500">
                        <Trophy className="w-5 h-5 mr-2" />Получить NFT-сертификат + Trial Pro
                      </Button>
                    )}
                    {!["create_agent", "graduate"].includes(activeModule.action_type || "") && !completedSlugs.has(activeModule.slug) && (
                      <Button onClick={() => completeModule(activeModule.slug)} className="w-full">
                        <CheckCircle2 className="w-4 h-4 mr-2" />Отметить пройденным (+{activeModule.reward_meeet} MEEET)
                      </Button>
                    )}
                    {completedSlugs.has(activeModule.slug) && (
                      <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Модуль пройден</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chat with Sara */}
            <Card className="lg:sticky lg:top-4 h-fit">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Sara — твой наставник</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] overflow-y-auto space-y-3 mb-3 pr-2">
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Спроси что угодно о текущем модуле или MEEET World 👋</p>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`p-2 rounded-lg text-sm ${m.role === "user" ? "bg-primary/10 ml-4" : "bg-muted mr-4"}`}>
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "..."}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Спроси Sara..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendChatMessage()}
                    disabled={chatStreaming}
                  />
                  <Button size="icon" onClick={sendChatMessage} disabled={chatStreaming || !chatInput.trim()}>
                    {chatStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Academy;
