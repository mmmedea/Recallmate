"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function ReactiveGrid({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || !finePointer || reduceMotion) return;

    let raf = 0;
    const target = { x: 50, y: 35 };
    const current = { x: 50, y: 35 };

    const move = (event: PointerEvent) => {
      target.x = (event.clientX / Math.max(window.innerWidth, 1)) * 100;
      target.y = (event.clientY / Math.max(window.innerHeight, 1)) * 100;
    };

    const tick = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      element.style.setProperty("--rm-grid-x", `${current.x}%`);
      element.style.setProperty("--rm-grid-y", `${current.y}%`);
      raf = window.requestAnimationFrame(tick);
    };

    const syncVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return <div ref={ref} className={cn("rm-reactive-grid", className)} aria-hidden="true" />;
}
