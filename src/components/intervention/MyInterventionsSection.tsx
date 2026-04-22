import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { getInterventionHistory, type InterventionRecord } from "@/lib/intervention";

export default function MyInterventionsSection() {
  const [items, setItems] = useState<InterventionRecord[]>([]);

  useEffect(() => {
    const load = () => setItems(getInterventionHistory().slice(0, 10));
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    const id = window.setInterval(load, 5000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-foreground">🎯 Мои вмешательства</h2>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <div className="grid gap-2">
        {items.map((rec) => (
          <Card key={rec.id} className="bg-card/60 backdrop-blur border-purple-500/20">
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground truncate">{rec.agentName}</span>
                <span className="text-muted-foreground shrink-0">
                  {new Date(rec.date).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {rec.context && (
                <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                  Контекст: {rec.context}
                </p>
              )}
              <p className="text-xs text-foreground">
                <span className="text-purple-400">→</span> {rec.hint}
              </p>
              <div className="flex items-center justify-between">
                <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px]">
                  Эффективность: {rec.impact}%
                </Badge>
                <span className="text-[10px] text-emerald-400">+10 XP</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
