import { ReactNode, Suspense, useEffect, useRef, useState } from "react";

interface LazyOnViewProps {
  children: ReactNode;
  /** Min height of the placeholder so layout stays stable before mount */
  minHeight?: number | string;
  /** rootMargin for IntersectionObserver — start mounting before reaching viewport */
  rootMargin?: string;
  fallback?: ReactNode;
}

/**
 * Mounts children only when the placeholder enters the viewport.
 * Wraps in Suspense so React.lazy() chunks don't block render.
 * Used to defer heavy below-the-fold homepage sections.
 */
const LazyOnView = ({
  children,
  minHeight = 200,
  rootMargin = "300px",
  fallback = null,
}: LazyOnViewProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
};

export default LazyOnView;
