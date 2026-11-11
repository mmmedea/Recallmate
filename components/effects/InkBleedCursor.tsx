"use client";

import { useEffect, useRef } from "react";

function shouldHideForTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [data-native-cursor], iframe, embed, object, canvas[data-preserve-cursor]"
    )
  );
}

export function InkBleedCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduceMotion) return;

    const canvas = canvasRef.current;
    const dot = dotRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !dot || !ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let visible = false;
    let hoveringAction = false;
    let hiddenForText = false;
    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const trail: Array<{ x: number; y: number; life: number; radius: number }> = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const setDot = () => {
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(${hoveringAction ? 1.55 : 1})`;
      dot.style.opacity = visible && !hiddenForText ? "1" : "0";
    };

    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      visible = true;
      hiddenForText = shouldHideForTarget(event.target);
      hoveringAction = Boolean((event.target as Element | null)?.closest?.("a, button, [role='button'], summary"));
      if (!hiddenForText) {
        trail.push({ x: pointer.x, y: pointer.y, life: 1, radius: hoveringAction ? 11 : 7 });
        if (trail.length > 18) trail.shift();
      }
      setDot();
    };

    const leave = () => {
      visible = false;
      setDot();
    };

    const down = () => {
      if (!hiddenForText) trail.push({ x: pointer.x, y: pointer.y, life: 1, radius: 18 });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const drop = trail[index];
        drop.life -= 0.045;
        drop.radius *= 0.985;
        if (drop.life <= 0) {
          trail.splice(index, 1);
          continue;
        }
        const gradient = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.radius * 2.2);
        gradient.addColorStop(0, `rgba(237, 229, 255, ${0.22 * drop.life})`);
        gradient.addColorStop(0.35, `rgba(124, 60, 255, ${0.14 * drop.life})`);
        gradient.addColorStop(1, "rgba(124, 60, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = window.requestAnimationFrame(draw);
    };

    const syncVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
        ctx.clearRect(0, 0, width, height);
      } else if (!raf) {
        raf = window.requestAnimationFrame(draw);
      }
    };

    resize();
    syncVisibility();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="rm-ink-cursor-canvas" aria-hidden="true" data-preserve-cursor />
      <div ref={dotRef} className="rm-ink-cursor-dot" aria-hidden="true" />
    </>
  );
}
