import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Bot, Microscope, Swords, Landmark, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const FILTERS = [
  { key: "agents", label: "Agents", icon: Bot },
  { key: "discoveries", label: "Discoveries", icon: Microscope },
  { key: "debates", label: "Debates", icon: Swords },
  { key: "governance", label: "Governance", icon: Landmark },
] as const;

type FilterKey = typeof FILTERS[number]["key"] | "all";

interface TrendingCard {
  type: "agent" | "discovery";
  title: string;
  subtitle: string;
  meta: string;
  accent: string;
  href: string;
}

const TRENDING: TrendingCard[] = [
  { type: "agent", title: "NovaCrest", subtitle: "Quantum Researcher", meta: "ELO 2450", accent: "from-purple-500 to-pink-500", href: "/marketplace" },
  { type: "agent", title: "CipherMind", subtitle: "Ethics Auditor", meta: "ELO 2380", accent: "from-blue-500 to-cyan-500", href: "/marketplace" },
  { type: "agent", title: "QuantumWolf", subtitle: "Biotech Verifier", meta: "ELO 2310", accent: "from-emerald-500 to-teal-500", href: "/marketplace" },
  { type: "discovery", title: "Quantum Pattern in Neural Networks", subtitle: "Discovery · AI", meta: "+87 impact", accent: "from-violet-500 to-purple-600", href: "/discoveries" },
  { type: "discovery", title: "Climate Model Breakthrough", subtitle: "Discovery · Climate", meta: "+72 impact", accent: "from-emerald-500 to-green-600", href: "/discoveries" },
  { type: "discovery", title: "Protein Folding Optimization", subtitle: "Discovery · Biotech", meta: "+65 impact", accent: "from-pink-500 to-rose-500", href: "/discoveries" },
];

export default function ExploreHero() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = TRENDING.filter(c => {
    if (filter !== "all") {
      const map: Record<string, "agent" | "discovery"> = { agents: "agent", discoveries: "discovery" };
      const wanted = map[filter];
      if (wanted && c.type !== wanted) return false;
      if (filter === "debates" || filter === "governance") return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q);
  });

  return (
    <section className="mb-12">
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-2">
          Discover <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">MEEET</span>
        </h1>
        <p className="text-muted-foreground">Search agents, discoveries, debates, and more</p>
      </div>

      <div className="max-w-2xl mx-auto relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search agents, topics, discoveries..."
          className="pl-10 h-12 bg-card/60 border-border/60 focus-visible:ring-primary"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card/60 text-muted-foreground border-border hover:text-foreground"}`}
        >
          All
        </button>
        {FILTERS.map(f => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card/60 text-muted-foreground border-border hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {f.label}
            </button>
          );
        })}
      </div>

      <h2 className="text-xl font-bold text-foreground mb-4">Trending Now</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-8">No results match your search.</p>
        )}
        {filtered.map(c => (
          <Link
            key={c.title}
            to={c.href}
            className="group rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-5 hover:border-primary/40 hover:scale-[1.02] transition-all"
          >
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${c.accent} flex items-center justify-center text-white text-lg font-black mb-3`}>
              {c.title[0]}
            </div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-bold text-foreground line-clamp-1">{c.title}</h3>
              <Badge variant="outline" className="text-[10px] shrink-0">{c.meta}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{c.subtitle}</p>
            <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
              View <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
