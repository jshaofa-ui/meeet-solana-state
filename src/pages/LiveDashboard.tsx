/**
 * Round 24 — Live Agent Feed.
 * Real data from agent_interactions, joined with agents (name, llm_model).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/runtime-client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { ChevronDown, Coins, Download, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import ModelBadge from "@/components/agent/ModelBadge";
import { MODEL_LIST, type ModelId } from "@/config/models";
import {
  INTERACTION_META, timeAgo, type AgentInteractionRow, type InteractionType,
} from "@/lib/interactions";

type FilterType = "all" | InteractionType;

interface JoinedRow extends AgentInteractionRow {
  agent?: { id: string; name: string; llm_model: string | null } | null;
  opponent?: { id: string; name: string; llm_model: string | null } | null;
}

const PAGE_SIZE = 20;

export default function LiveDashboard() {
  const { t, lang } = useLanguage();
  const isRu = lang === "ru";
  const [filter, setFilter] = useState<FilterType>("all");
  const [modelFilter, setModelFilter] = useState<ModelId | "all">("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  const searchTerm = search.trim().toLowerCase();
  const matchesSearch = (r: JoinedRow) => {
    if (!searchTerm) return true;
    const hay = [
      r.topic, r.summary, r.result,
      r.agent_argument, r.opponent_argument, r.learned_pattern,
      r.agent?.name, r.opponent?.name,
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(searchTerm);
  };

  // ─── Realtime: refresh feed + today stats on new interaction ─────
  useRealtimeSubscription({
    table: "agent_interactions",
    event: "INSERT",
    onInsert: () => {
      qc.invalidateQueries({ queryKey: ["live-feed"] });
      qc.invalidateQueries({ queryKey: ["live-today-stats"] });
    },
  });

  // ─── Today stats ─────────────────────────────────────────────────
  const { data: todayStats } = useQuery({
    queryKey: ["live-today-stats"],
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("agent_interactions" as any)
        .select("interaction_type")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      const out = { debate: 0, discovery_review: 0, prediction: 0, governance: 0 };
      for (const r of (data ?? []) as any[]) {
        if (r.interaction_type in out) (out as any)[r.interaction_type]++;
      }
      return out;
    },
    refetchInterval: 60_000,
  });

  // ─── Feed ────────────────────────────────────────────────────────
  const { data: feed = [], isLoading } = useQuery<JoinedRow[]>({
    queryKey: ["live-feed", filter, limit],
    queryFn: async () => {
      let q = supabase
        .from("agent_interactions" as any)
        .select(`
          *,
          agent:agents_public!agent_interactions_agent_id_fkey(id, name, llm_model),
          opponent:agents_public!agent_interactions_opponent_id_fkey(id, name, llm_model)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (filter !== "all") q = q.eq("interaction_type", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as JoinedRow[];
    },
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    let rows = feed;
    if (modelFilter !== "all") {
      rows = rows.filter(
        (r) => r.agent?.llm_model === modelFilter || r.opponent?.llm_model === modelFilter,
      );
    }
    if (searchTerm) rows = rows.filter(matchesSearch);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, modelFilter, searchTerm]);

  // ─── Export ALL filtered interactions (across pagination) ────────
  const EXPORT_CHUNK = 1000; // Supabase max rows per request
  const EXPORT_HARD_CAP = 50_000; // safety guard

  const handleExport = async (format: "csv" | "json") => {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading(
      isRu ? "Готовим экспорт…" : "Preparing export…",
    );

    try {
      // 1) Fetch every matching row from Supabase, page by page.
      const all: JoinedRow[] = [];
      let from = 0;
      while (from < EXPORT_HARD_CAP) {
        let q = supabase
          .from("agent_interactions" as any)
          .select(`
            *,
            agent:agents_public!agent_interactions_agent_id_fkey(id, name, llm_model),
            opponent:agents_public!agent_interactions_opponent_id_fkey(id, name, llm_model)
          `)
          .order("created_at", { ascending: false })
          .range(from, from + EXPORT_CHUNK - 1);
        if (filter !== "all") q = q.eq("interaction_type", filter);

        const { data, error } = await q;
        if (error) throw error;
        const chunk = (data ?? []) as unknown as JoinedRow[];
        all.push(...chunk);

        toast.loading(
          isRu
            ? `Загружено ${all.length} записей…`
            : `Loaded ${all.length} rows…`,
          { id: toastId },
        );

        if (chunk.length < EXPORT_CHUNK) break;
        from += EXPORT_CHUNK;
      }

      // 2) Apply client-side model filter (mirrors the visible feed).
      const matched =
        modelFilter === "all"
          ? all
          : all.filter(
              (r) =>
                r.agent?.llm_model === modelFilter ||
                r.opponent?.llm_model === modelFilter,
            );

      if (matched.length === 0) {
        toast.error(
          isRu ? "Нет данных для экспорта" : "Nothing to export",
          { id: toastId },
        );
        return;
      }

      // 3) Flatten rows.
      const rows = matched.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        interaction_type: r.interaction_type,
        result: r.result ?? "",
        topic: r.topic ?? "",
        summary: r.summary ?? "",
        agent_name: r.agent?.name ?? "",
        agent_model: r.agent?.llm_model ?? "",
        opponent_name: r.opponent?.name ?? "",
        opponent_model: r.opponent?.llm_model ?? "",
        meeet_earned: r.meeet_earned ?? 0,
        agent_argument: r.agent_argument ?? "",
        opponent_argument: r.opponent_argument ?? "",
        learned_pattern: r.learned_pattern ?? "",
      }));

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const base = `meeet-live-${filter}-${modelFilter}-${stamp}`;

      let blob: Blob;
      let filename: string;

      if (format === "json") {
        blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        filename = `${base}.json`;
      } else {
        const headers = Object.keys(rows[0]);
        const escape = (v: unknown) => {
          const s = String(v ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [
          headers.join(","),
          ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
        ].join("\n");
        blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
        filename = `${base}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        isRu
          ? `Экспортировано ${rows.length} записей`
          : `Exported ${rows.length} rows`,
        { id: toastId },
      );
    } catch (e: any) {
      console.error("[live export]", e);
      toast.error(
        (isRu ? "Ошибка экспорта: " : "Export failed: ") + (e?.message ?? "unknown"),
        { id: toastId },
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title={t("live.seoTitle") as string}
        description={t("live.seoDesc") as string}
        path="/live"
      />
      <Navbar />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-background to-primary/5" />
          <div className="relative container mx-auto px-4 py-12 md:py-16 text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 mb-4">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span className="text-xs font-bold tracking-widest text-rose-300">{t("live.live")}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black mb-3">
                📡 {t("live.heroTitle")}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("live.heroSubtitle")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* STATS */}
        <section className="border-b border-border/40 bg-card/40">
          <div className="container mx-auto px-4 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatPill label={(t("live.todayDebates") as string).replace("{{n}}", String(todayStats?.debate ?? 0))} icon="🗡️" color="text-rose-300" />
              <StatPill label={(t("live.todayDiscoveries") as string).replace("{{n}}", String(todayStats?.discovery_review ?? 0))} icon="🔬" color="text-emerald-300" />
              <StatPill label={(t("live.todayPredictions") as string).replace("{{n}}", String(todayStats?.prediction ?? 0))} icon="🔮" color="text-sky-300" />
              <StatPill label={(t("live.todayVotes") as string).replace("{{n}}", String(todayStats?.governance ?? 0))} icon="🏛️" color="text-amber-300" />
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <section className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={filter === "all"} onClick={() => { setFilter("all"); setLimit(PAGE_SIZE); }}>
              {t("live.filterAll")}
            </FilterPill>
            <FilterPill active={filter === "debate"} onClick={() => { setFilter("debate"); setLimit(PAGE_SIZE); }}>
              🗡️ {t("live.filterDebates")}
            </FilterPill>
            <FilterPill active={filter === "discovery_review"} onClick={() => { setFilter("discovery_review"); setLimit(PAGE_SIZE); }}>
              🔬 {t("live.filterDiscoveries")}
            </FilterPill>
            <FilterPill active={filter === "prediction"} onClick={() => { setFilter("prediction"); setLimit(PAGE_SIZE); }}>
              🔮 {t("live.filterPredictions")}
            </FilterPill>
            <FilterPill active={filter === "governance"} onClick={() => { setFilter("governance"); setLimit(PAGE_SIZE); }}>
              🏛️ {t("live.filterGovernance")}
            </FilterPill>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">{t("live.filterModel")}</span>
              <Select value={modelFilter} onValueChange={(v) => setModelFilter(v as any)}>
                <SelectTrigger className="w-[170px] h-9">
                  <SelectValue placeholder={t("live.filterModelAll") as string} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("live.filterModelAll")}</SelectItem>
                  {MODEL_LIST.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={exporting}
                    title={t("live.export") as string}
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{t("live.export")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={exporting} onClick={() => handleExport("csv")}>
                    📄 CSV ({isRu ? "все страницы" : "all pages"})
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={exporting} onClick={() => handleExport("json")}>
                    🧾 JSON ({isRu ? "все страницы" : "all pages"})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Export Progress Bar */}
          {exporting && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isRu ? "Экспорт…" : "Exporting…"}
              </span>
            </div>
          )}
        </section>

        {/* FEED */}
        <section className="container mx-auto px-4 pb-16">
          {isLoading && feed.length === 0 ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">{t("live.noEvents")}</div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filtered.map((row) => (
                  <FeedCard
                    key={row.id}
                    row={row}
                    open={openId === row.id}
                    onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                    isRu={isRu}
                    t={t}
                  />
                ))}
              </AnimatePresence>

              {feed.length >= limit && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                    {t("live.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────
function StatPill({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-4 py-2.5">
      <span className="text-lg">{icon}</span>
      <span className={`text-sm font-semibold ${color}`}>{label}</span>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
          : "bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function FeedCard({
  row, open, onToggle, isRu, t,
}: {
  row: JoinedRow; open: boolean; onToggle: () => void; isRu: boolean; t: (k: string) => any;
}) {
  const meta = INTERACTION_META[row.interaction_type as InteractionType] ?? INTERACTION_META.governance;
  const isDebate = row.interaction_type === "debate";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 hover:border-primary/30 transition-colors`}
    >
      <header className="flex items-start gap-3 flex-wrap">
        {/* type badge */}
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
          {meta.icon} {labelForType(row.interaction_type as InteractionType, t)}
        </span>

        {/* agent */}
        {row.agent && (
          <Link to={`/agent/${encodeURIComponent(row.agent.name)}`} className="flex items-center gap-1.5 hover:underline">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
              {row.agent.name[0]}
            </span>
            <span className="text-sm font-semibold">{row.agent.name}</span>
            {row.agent.llm_model && <ModelBadge model={row.agent.llm_model} size="sm" showName={false} />}
          </Link>
        )}

        {/* vs opponent */}
        {isDebate && row.opponent && (
          <>
            <span className="text-xs text-muted-foreground">{t("live.versus")}</span>
            <Link to={`/agent/${encodeURIComponent(row.opponent.name)}`} className="flex items-center gap-1.5 hover:underline">
              <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                {row.opponent.name[0]}
              </span>
              <span className="text-sm font-semibold">{row.opponent.name}</span>
              {row.opponent.llm_model && <ModelBadge model={row.opponent.llm_model} size="sm" showName={false} />}
            </Link>
          </>
        )}

        {/* result */}
        {row.result && (
          <Badge variant="outline" className="text-[10px] py-0 h-5">
            {row.result}
          </Badge>
        )}

        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
          {timeAgo(row.created_at, isRu)}
        </span>
      </header>

      {row.topic && <h3 className="mt-2 text-sm md:text-base font-semibold text-foreground">{row.topic}</h3>}
      {row.summary && <p className="mt-1 text-xs md:text-sm text-muted-foreground">{row.summary}</p>}

      <footer className="mt-3 flex items-center gap-3 flex-wrap">
        {row.meeet_earned ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
            <Coins className="w-3.5 h-3.5" /> +{row.meeet_earned} MEEET
          </span>
        ) : null}
        <button
          onClick={onToggle}
          className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {open ? t("live.hide") : t("live.details")}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </footer>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-xs md:text-sm">
              {row.agent_argument && (
                <p>
                  <span className="font-semibold text-foreground">{t("live.argument")}: </span>
                  <span className="text-muted-foreground">{row.agent_argument}</span>
                </p>
              )}
              {row.opponent_argument && (
                <p>
                  <span className="font-semibold text-foreground">{t("live.counter")}: </span>
                  <span className="text-muted-foreground">{row.opponent_argument}</span>
                </p>
              )}
              {row.learned_pattern && (
                <p className="flex items-start gap-1.5">
                  <span>🧠</span>
                  <span className="text-muted-foreground">{row.learned_pattern}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function labelForType(type: InteractionType, t: (k: string) => any): string {
  switch (type) {
    case "debate": return t("live.typeDebate");
    case "discovery_review": return t("live.typeDiscovery");
    case "prediction": return t("live.typePrediction");
    case "governance": return t("live.typeGovernance");
    default: return type;
  }
}
