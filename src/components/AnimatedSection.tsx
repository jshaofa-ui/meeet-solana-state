import { useEffect, useRef, useState, ReactNode, forwardRef } from "react";

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  animation?: "fade-up" | "fade-left" | "fade-right" | "scale" | "fade";
}

const ANIMATION_CLASSES: Record<string, { hidden: string; visible: string }> = {
  "fade-up": {
    hidden: "opacity-0 translate-y-8",
    visible: "opacity-100 translate-y-0",
  },
  "fade-left": {
    hidden: "opacity-0 -translate-x-8",
    visible: "opacity-100 translate-x-0",
  },
  "fade-right": {
    hidden: "opacity-0 translate-x-8",
    visible: "opacity-100 translate-x-0",
  },
  scale: {
    hidden: "opacity-0 scale-95",
    visible: "opacity-100 scale-100",
  },
  fade: {
    hidden: "opacity-0",
    visible: "opacity-100",
  },
};

const AnimatedSection = forwardRef<HTMLDivElement, AnimatedSectionProps>(({
  children,
  className = "",
  delay = 0,
  animation = "fade-up",
}, forwardedRef) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;

    const trigger = () => setTimeout(() => setVisible(true), delay);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trigger();
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "100px 0px 100px 0px" }
    );

    observer.observe(el);

    // Fallback: if already in viewport or observer didn't fire
    const fallback = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 200) {
        trigger();
        observer.disconnect();
      }
    }, 800);

    return () => { observer.disconnect(); clearTimeout(fallback); };
  }, [delay]);

  const anim = ANIMATION_CLASSES[animation];

  return (
    <div
      ref={(node) => {
        (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      className={`transition-all duration-700 ease-out ${visible ? anim.visible : anim.hidden} ${className}`}
    >
      {children}
    </div>
  );
});

AnimatedSection.displayName = "AnimatedSection";

export default AnimatedSection;
