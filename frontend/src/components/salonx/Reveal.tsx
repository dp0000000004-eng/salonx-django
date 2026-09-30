import { useEffect, useRef, useState } from "react";

/**
 * Fires once when the element first scrolls into view. Uses IntersectionObserver
 * (no scroll listeners, no animation loops) so fast scrolling stays smooth.
 */
export function useInViewOnce<T extends HTMLElement>(rootMargin = "0px 0px -8% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}

type RevealProps = {
  children: React.ReactNode;
  /** Stagger delay in ms. Keep small (0–250ms). */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
};

/** Wrapper that fades + lifts its children into place a single time. */
export function Reveal({ children, delay = 0, className = "", as = "div" }: RevealProps) {
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref}
      data-in={inView ? "true" : "false"}
      style={delay ? ({ "--sx-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={`sx-reveal ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Small helper for per-item stagger without duplicating delay maths. */
export function stagger(index: number, step = 50, max = 250) {
  return Math.min(index * step, max);
}
