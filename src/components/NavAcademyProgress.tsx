import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAcademyProgress } from "@/hooks/useAcademyProgress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const NavAcademyProgress = () => {
  const { data } = useAcademyProgress();
  if (!data || data.totalModules === 0) return null;

  if (data.graduated) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/academy"
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <GraduationCap className="w-3 h-3" />
              <span className="font-semibold">Graduate</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent>All {data.totalModules} lessons completed 🎓</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Color tiers: 0% gray, 1-50% yellow, 51-99% orange, 100% green
  const pct = data.pct;
  const tier =
    pct === 0
      ? { text: "text-gray-400", bar: "from-gray-500 to-gray-400", border: "border-gray-500/30", bg: "bg-gray-500/5" }
      : pct <= 50
      ? { text: "text-yellow-400", bar: "from-yellow-500 to-yellow-300", border: "border-yellow-500/30", bg: "bg-yellow-500/5" }
      : pct <= 99
      ? { text: "text-orange-400", bar: "from-orange-500 to-orange-300", border: "border-orange-500/30", bg: "bg-orange-500/5" }
      : { text: "text-emerald-400", bar: "from-emerald-500 to-emerald-300", border: "border-emerald-500/30", bg: "bg-emerald-500/5" };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/academy"
            className={`hidden md:flex items-center gap-2 px-2 py-1 rounded-md border ${tier.border} ${tier.bg} hover:bg-muted/40 transition-colors group`}
          >
            <GraduationCap className={`w-3.5 h-3.5 ${tier.text}`} />
            <div className="flex flex-col gap-0.5 min-w-[50px]">
              <div className="text-[9px] text-muted-foreground leading-none">Academy</div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${tier.bar} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className={`text-[10px] font-bold ${tier.text}`}>{pct}%</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          {data.completed}/{data.totalModules} lessons completed
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NavAcademyProgress;
