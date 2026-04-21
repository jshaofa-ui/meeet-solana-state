/**
 * Round 24 — Live Agent Feed.
 * Real data from agent_interactions, joined with agents (name, llm_model).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
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
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";
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

type ColumnKey =
  | "id" | "created_at" | "interaction_type" | "result"
  | "topic" | "summary"
  | "agent_name" | "agent_model" | "opponent_name" | "opponent_model"
  | "meeet_earned" | "agent_argument" | "opponent_argument" | "learned_pattern";

const COLUMN_DEFS: { key: ColumnKey; en: string; ru: string; group: "meta" | "agents" | "content" | "earnings" }[] = [
  { key: "id",                en: "ID",                 ru: "ID",              group: "meta" },
  { key: "created_at",        en: "Date",               ru: "Дата",            group: "meta" },
  { key: "interaction_type",  en: "Type",               ru: "Тип",             group: "meta" },
  { key: "result",            en: "Result",             ru: "Результат",       group: "meta" },
  { key: "topic",             en: "Topic",              ru: "Тема",            group: "content" },
  { key: "summary",           en: "Summary",            ru: "Резюме",          group: "content" },
  { key: "agent_name",        en: "Agent name",         ru: "Имя агента",      group: "agents" },
  { key: "agent_model",       en: "Agent model",        ru: "Модель агента",   group: "agents" },
  { key: "opponent_name",     en: "Opponent name",      ru: "Имя оппонента",   group: "agents" },
  { key: "opponent_model",    en: "Opponent model",     ru: "Модель оппонента",group: "agents" },
  { key: "agent_argument",    en: "Agent argument",     ru: "Аргумент агента", group: "content" },
  { key: "opponent_argument", en: "Opponent argument",  ru: "Аргумент оппонента", group: "content" },
  { key: "learned_pattern",   en: "Learned pattern",    ru: "Выученный паттерн", group: "content" },
  { key: "meeet_earned",      en: "MEEET earned",       ru: "Заработок MEEET", group: "earnings" },
];

const DEFAULT_COLUMNS: ColumnKey[] = COLUMN_DEFS.map((c) => c.key);
const STORAGE_KEY = "live-export-columns-v1";


export default function LiveDashboard() {
  const { t, lang } = useLanguage();
  const isRu = lang === "ru";
  // ─── Filter state — restored from URL query (?type=&model=&q=) ───
  const [searchParams, setSearchParams] = useSearchParams();
  const FILTER_VALUES: FilterType[] = ["all", "debate", "discovery_review", "prediction", "governance"];
  const initialFilter = (() => {
    const v = searchParams.get("type");
    return v && (FILTER_VALUES as string[]).includes(v) ? (v as FilterType) : "all";
  })();
  const initialModel = (() => {
    const v = searchParams.get("model");
    if (!v || v === "all") return "all" as ModelId | "all";
    return MODEL_LIST.some((m) => m.id === v) ? (v as ModelId) : ("all" as ModelId | "all");
  })();
  const initialSearch = searchParams.get("q") ?? "";
  const initialCase = searchParams.get("cs") === "1";
  const MATCH_MODES = ["substring", "exact", "word"] as const;
  type MatchMode = (typeof MATCH_MODES)[number];
  const initialMode = ((): MatchMode => {
    const v = searchParams.get("mode");
    return (MATCH_MODES as readonly string[]).includes(v ?? "") ? (v as MatchMode) : "substring";
  })();

  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [modelFilter, setModelFilter] = useState<ModelId | "all">(initialModel);
  const [search, setSearch] = useState(initialSearch);
  const [caseSensitive, setCaseSensitive] = useState<boolean>(initialCase);
  const [matchMode, setMatchMode] = useState<MatchMode>(initialMode);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Persist filter/model/search/options to URL — replace, no history spam.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter === "all") next.delete("type"); else next.set("type", filter);
    if (modelFilter === "all") next.delete("model"); else next.set("model", modelFilter);
    const q = search.trim();
    if (!q) next.delete("q"); else next.set("q", q);
    if (caseSensitive) next.set("cs", "1"); else next.delete("cs");
    if (matchMode === "substring") next.delete("mode"); else next.set("mode", matchMode);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, modelFilter, search, caseSensitive, matchMode]);


  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [columns, setColumns] = useState<ColumnKey[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_COLUMNS;
      const parsed = JSON.parse(raw) as string[];
      const valid = parsed.filter((k): k is ColumnKey =>
        DEFAULT_COLUMNS.includes(k as ColumnKey),
      );
      return valid.length ? valid : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });
  const toggleColumn = (key: ColumnKey) => {
    setColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setAllColumns = (all: boolean) => {
    const next = all ? DEFAULT_COLUMNS : [];
    setColumns(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };
  const qc = useQueryClient();

  // ─── Search engine: case + match-mode aware ──────────────────────
  const rawTerm = search.trim();
  const searchActive = rawTerm.length > 0;
  // Build a single RegExp used for both filtering and highlighting.
  const searchRegex = useMemo(() => {
    if (!searchActive) return null;
    const escaped = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let pattern: string;
    if (matchMode === "exact") pattern = `^${escaped}$`;
    else if (matchMode === "word") pattern = `\\b${escaped}\\b`;
    else pattern = escaped;
    const flags = "g" + (caseSensitive ? "" : "i");
    try {
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }, [rawTerm, matchMode, caseSensitive, searchActive]);

  const matchesSearch = (r: JoinedRow) => {
    if (!searchRegex) return true;
    const fields = [
      r.topic, r.summary, r.result,
      r.agent_argument, r.opponent_argument, r.learned_pattern,
      r.agent?.name, r.opponent?.name,
    ].filter(Boolean) as string[];
    if (matchMode === "exact") {
      // exact = whole-field equality (case-sensitive depending on flag).
      return fields.some((f) =>
        caseSensitive ? f === rawTerm : f.toLowerCase() === rawTerm.toLowerCase(),
      );
    }
    // For substring/word, run regex against joined haystack — single pass.
    searchRegex.lastIndex = 0;
    return searchRegex.test(fields.join(" "));
  };
  // For backwards compat — used in export filename.
  const searchTerm = rawTerm.toLowerCase();


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

  const handleExport = async (format: "csv" | "json", scope: "page" | "all" = "all") => {
    if (exporting) return;
    if (columns.length === 0) {
      toast.error(isRu ? "Выберите хотя бы одну колонку" : "Pick at least one column");
      return;
    }
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

      // 2) Apply client-side model + search filter (mirrors visible feed).
      let matched = all;
      if (modelFilter !== "all") {
        matched = matched.filter(
          (r) =>
            r.agent?.llm_model === modelFilter ||
            r.opponent?.llm_model === modelFilter,
        );
      }
      if (searchTerm) matched = matched.filter(matchesSearch);

      if (matched.length === 0) {
        toast.error(
          isRu ? "Нет данных для экспорта" : "Nothing to export",
          { id: toastId },
        );
        return;
      }

      // 3) Flatten rows — only include user-selected columns, in COLUMN_DEFS order.
      const fullRow = (r: JoinedRow): Record<ColumnKey, string | number> => ({
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
      });
      const orderedCols = COLUMN_DEFS.map((c) => c.key).filter((k) => columns.includes(k));
      const rows = matched.map((r) => {
        const f = fullRow(r);
        const out: Record<string, string | number> = {};
        for (const k of orderedCols) out[k] = f[k];
        return out;
      });

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const safeSearch = searchTerm
        ? "-q-" + searchTerm.replace(/[^a-z0-9]+/gi, "_").slice(0, 24)
        : "";
      const base = `meeet-live-${filter}-${modelFilter}${safeSearch}-${stamp}`;

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

            <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-2 sm:flex-1 sm:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setLimit(PAGE_SIZE); }}
                  placeholder={isRu ? "Поиск по тексту…" : "Search text…"}
                  className="h-9 pl-8 pr-8"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select value={matchMode} onValueChange={(v) => { setMatchMode(v as any); setLimit(PAGE_SIZE); }}>
                <SelectTrigger className="w-[120px] h-9 shrink-0" title={isRu ? "Режим поиска" : "Match mode"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="substring">{isRu ? "Частичный" : "Substring"}</SelectItem>
                  <SelectItem value="word">{isRu ? "Слово" : "Whole word"}</SelectItem>
                  <SelectItem value="exact">{isRu ? "Точный" : "Exact"}</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => { setCaseSensitive((v) => !v); setLimit(PAGE_SIZE); }}
                aria-pressed={caseSensitive}
                title={isRu ? "Учитывать регистр" : "Case sensitive"}
                className={`h-9 px-2.5 rounded-md border text-xs font-bold tracking-tight transition-colors shrink-0 ${
                  caseSensitive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                Aa
              </button>
            </div>


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

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    title={isRu ? "Колонки экспорта" : "Export columns"}
                  >
                    <Settings2 className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {isRu ? "Колонки" : "Columns"} ({columns.length}/{DEFAULT_COLUMNS.length})
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">
                      {isRu ? "Колонки экспорта" : "Export columns"}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setAllColumns(true)}
                      >
                        {isRu ? "Все" : "All"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setAllColumns(false)}
                      >
                        {isRu ? "Нет" : "None"}
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5">
                    {COLUMN_DEFS.map((c) => {
                      const checked = columns.includes(c.key);
                      return (
                        <label
                          key={c.key}
                          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleColumn(c.key)}
                          />
                          <span className="flex-1">{isRu ? c.ru : c.en}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

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
                    highlight={searchRegex}
                    matchMode={matchMode}
                    rawTerm={rawTerm}
                    caseSensitive={caseSensitive}
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
  row, open, onToggle, isRu, t, highlight, matchMode, rawTerm, caseSensitive,
}: {
  row: JoinedRow; open: boolean; onToggle: () => void; isRu: boolean; t: (k: string) => any;
  highlight: RegExp | null;
  matchMode: "substring" | "exact" | "word";
  rawTerm: string;
  caseSensitive: boolean;
}) {
  const meta = INTERACTION_META[row.interaction_type as InteractionType] ?? INTERACTION_META.governance;
  const isDebate = row.interaction_type === "debate";

  // Helper: render a string with <mark> around regex matches.
  const HL = ({ text }: { text: string | null | undefined }) => (
    <Highlight
      text={text ?? ""}
      regex={highlight}
      matchMode={matchMode}
      rawTerm={rawTerm}
      caseSensitive={caseSensitive}
    />
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 hover:border-primary/30 transition-colors`}
    >
      <header className="flex items-start gap-3 flex-wrap">
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
          {meta.icon} {labelForType(row.interaction_type as InteractionType, t)}
        </span>

        {row.agent && (
          <Link to={`/agent/${encodeURIComponent(row.agent.name)}`} className="flex items-center gap-1.5 hover:underline">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
              {row.agent.name[0]}
            </span>
            <span className="text-sm font-semibold"><HL text={row.agent.name} /></span>
            {row.agent.llm_model && <ModelBadge model={row.agent.llm_model} size="sm" showName={false} />}
          </Link>
        )}

        {isDebate && row.opponent && (
          <>
            <span className="text-xs text-muted-foreground">{t("live.versus")}</span>
            <Link to={`/agent/${encodeURIComponent(row.opponent.name)}`} className="flex items-center gap-1.5 hover:underline">
              <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                {row.opponent.name[0]}
              </span>
              <span className="text-sm font-semibold"><HL text={row.opponent.name} /></span>
              {row.opponent.llm_model && <ModelBadge model={row.opponent.llm_model} size="sm" showName={false} />}
            </Link>
          </>
        )}

        {row.result && (
          <Badge variant="outline" className="text-[10px] py-0 h-5">
            <HL text={row.result} />
          </Badge>
        )}

        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
          {timeAgo(row.created_at, isRu)}
        </span>
      </header>

      {row.topic && <h3 className="mt-2 text-sm md:text-base font-semibold text-foreground"><HL text={row.topic} /></h3>}
      {row.summary && <p className="mt-1 text-xs md:text-sm text-muted-foreground"><HL text={row.summary} /></p>}

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
                  <span className="text-muted-foreground"><HL text={row.agent_argument} /></span>
                </p>
              )}
              {row.opponent_argument && (
                <p>
                  <span className="font-semibold text-foreground">{t("live.counter")}: </span>
                  <span className="text-muted-foreground"><HL text={row.opponent_argument} /></span>
                </p>
              )}
              {row.learned_pattern && (
                <p className="flex items-start gap-1.5">
                  <span>🧠</span>
                  <span className="text-muted-foreground"><HL text={row.learned_pattern} /></span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// Renders text with <mark> around matches; safe — splits via regex, no innerHTML.
function Highlight({
  text, regex, matchMode, rawTerm, caseSensitive,
}: {
  text: string;
  regex: RegExp | null;
  matchMode: "substring" | "exact" | "word";
  rawTerm: string;
  caseSensitive: boolean;
}) {
  if (!text || !regex || !rawTerm) return <>{text}</>;

  // Exact mode: only highlight when whole field equals the term.
  if (matchMode === "exact") {
    const equal = caseSensitive
      ? text === rawTerm
      : text.toLowerCase() === rawTerm.toLowerCase();
    if (!equal) return <>{text}</>;
    return <mark className="bg-primary/30 text-foreground rounded-sm px-0.5">{text}</mark>;
  }

  // Substring/word: split via global regex. Reset lastIndex for safety.
  const parts: Array<{ s: string; hit: boolean }> = [];
  let lastIndex = 0;
  const re = new RegExp(regex.source, regex.flags); // fresh instance per render
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push({ s: text.slice(lastIndex, m.index), hit: false });
    parts.push({ s: m[0], hit: true });
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // avoid infinite loop on zero-width
  }
  if (lastIndex < text.length) parts.push({ s: text.slice(lastIndex), hit: false });
  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.hit
          ? <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">{p.s}</mark>
          : <span key={i}>{p.s}</span>,
      )}
    </>
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
