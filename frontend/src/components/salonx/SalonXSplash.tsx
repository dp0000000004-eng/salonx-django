import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SalonXLoader } from "./SalonXLoader";

const VISIBLE_MS = 1300;
const FADE_MS = 450;

/**
 * Brand splash shown on first app load, plus a lightweight overlay during
 * route transitions so the SalonX wordmark animation is always visible.
 */
export function SalonXSplash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");
  const isNavigating = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading,
  });

  useEffect(() => {
    const hideTimer = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const doneTimer = setTimeout(() => setPhase("done"), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const showBoot = phase !== "done";
  if (!showBoot && !isNavigating) return null;

  const fading = showBoot && phase === "fading" && !isNavigating;

  return (
    <div
      aria-hidden={fading}
      className="fixed inset-0 z-[200] transition-opacity duration-500 ease-out"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      <SalonXLoader fullScreen />
    </div>
  );
}

export default SalonXSplash;
