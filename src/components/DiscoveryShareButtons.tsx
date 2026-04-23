import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface DiscoveryShareButtonsProps {
  title: string;
  discoveryId?: string;
  /** "inline" = row of buttons, "icon" = single share icon dropdown */
  mode?: "inline" | "icon";
  className?: string;
}

const BASE_URL = "https://meeet.world/discoveries";

function getUrl(id?: string) {
  return id ? `${BASE_URL}/${id}` : BASE_URL;
}

function shareToX(title: string, id?: string) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${title} - AI Discovery by MEEET STATE`
  )}&url=${encodeURIComponent(getUrl(id))}&hashtags=MEEET,AI,Solana`;
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
}

function shareToTelegram(title: string, id?: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(
    getUrl(id)
  )}&text=${encodeURIComponent(`${title} - AI Discovery by MEEET STATE`)}`;
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
}

async function copyLink(id?: string) {
  try {
    await navigator.clipboard.writeText(getUrl(id));
    return true;
  } catch {
    return false;
  }
}

/** Compact icon-only share button for discovery cards */
export function DiscoveryShareIcon({ title, discoveryId, className = "" }: DiscoveryShareButtonsProps) {
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (navigator.share) {
      try {
        await navigator.share({ text: `${title} - AI Discovery by MEEET STATE`, url: getUrl(discoveryId) });
        return;
      } catch {}
    }
    shareToX(title, discoveryId);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ${className}`}
            aria-label="Share discovery"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Поделиться</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Full row of share buttons for detail/expanded views */
export function DiscoveryShareRow({ title, discoveryId, className = "" }: DiscoveryShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyLink(discoveryId);
    if (ok) {
      setCopied(true);
      toast.success("Copied!", { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleX = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    shareToX(title, discoveryId);
  };

  const handleTg = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    shareToTelegram(title, discoveryId);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={handleX}
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10">
              <span className="font-bold text-[11px]">𝕏</span>
              <span className="hidden sm:inline text-[11px]">Поделиться</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Share to X</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={handleTg}
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10">
              <span className="text-[11px]">✈️</span>
              <span className="hidden sm:inline text-[11px]">Telegram</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Share to Telegram</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={handleCopy}
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="hidden sm:inline text-[11px]">{copied ? "Copied!" : "Copy"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{copied ? "Copied!" : "Copy Link"}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
