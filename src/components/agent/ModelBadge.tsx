import { getModelConfig } from "@/config/models";
import { useLanguage } from "@/i18n/LanguageContext";

interface ModelBadgeProps {
  model: string | null | undefined;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

/**
 * Round 23 — pill-shaped badge displaying agent's LLM "DNA" model.
 * Colors derived from src/config/models.ts (semantic — model-specific brand colors).
 */
const ModelBadge = ({ model, size = "sm", showName = true, className = "" }: ModelBadgeProps) => {
  const cfg = getModelConfig(model);
  const { lang } = useLanguage();
  const character = lang === "ru" ? cfg.character : cfg.characterEn;

  const sizeClasses: Record<NonNullable<ModelBadgeProps["size"]>, string> = {
    sm: "h-6 px-2 text-[11px] gap-1",
    md: "h-8 px-2.5 text-[13px] gap-1.5",
    lg: "h-auto py-2 px-3 text-sm gap-2",
  };

  const iconSize: Record<NonNullable<ModelBadgeProps["size"]>, string> = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold transition-all hover:shadow-[0_0_12px_var(--model-glow)] ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: `${cfg.color}33`,           // 20% opacity
        borderColor: `${cfg.color}66`,                // 40% opacity
        color: cfg.color,
        ["--model-glow" as string]: `${cfg.color}80`, // 50% opacity for glow on hover
      }}
      title={`${cfg.fullName} — ${character}`}
      aria-label={`${cfg.fullName}: ${character}`}
    >
      <span className={iconSize[size]} aria-hidden="true">{cfg.icon}</span>
      {showName && (
        <span className="leading-none">
          {size === "lg" ? cfg.fullName : cfg.name}
        </span>
      )}
      {size === "lg" && (
        <span className="text-xs opacity-70 font-normal ml-1">— {character}</span>
      )}
    </span>
  );
};

export default ModelBadge;
