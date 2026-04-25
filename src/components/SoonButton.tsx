import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const COMING_SOON_MESSAGE =
  "Скоро — будет доступно при запуске основной сети.";

export function showComingSoonToast() {
  toast(COMING_SOON_MESSAGE);
}

export function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300",
        className,
      )}
    >
      Скоро
    </span>
  );
}

interface SoonButtonProps extends ButtonProps {
  showBadge?: boolean;
}

/**
 * A button that toasts "Coming Soon" instead of performing an action.
 * Use for stake/claim/vote/mint flows that depend on mainnet.
 */
export const SoonButton = forwardRef<HTMLButtonElement, SoonButtonProps>(
  ({ children, showBadge = true, onClick, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        {...props}
        onClick={(e) => {
          showComingSoonToast();
          onClick?.(e);
        }}
      >
        {children}
        {showBadge && <SoonBadge className="ml-2" />}
      </Button>
    );
  },
);
SoonButton.displayName = "SoonButton";
