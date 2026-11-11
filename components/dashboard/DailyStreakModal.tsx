"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Flame, Target, Trophy, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/dashboard/get-dashboard-data";

export function DailyStreakModal({ data }: { data: DashboardData["economy"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const manuallyRequested = searchParams.get("streak") === "1";
  const rewardWindowRequested = searchParams.get("reward") === "1";
  const checkedInToday = data.state === "ok" && !data.canClaimDailyReward && !data.canRestoreStreak;
  const streakNum = Math.max(0, data.streak || 0);
  const fireGlow = true;
  const actionMode = data.canRestoreStreak ? "restore" : data.canClaimDailyReward ? "claim" : null;
  const studyDayKey = data.studyDay ?? "unknown-day";
  const dismissKey = `recallmate:daily-streak-dismissed:${studyDayKey}:${actionMode ?? "none"}`;

  useEffect(() => {
    const dismissed = typeof sessionStorage !== "undefined" && sessionStorage.getItem(dismissKey) === "true";
    const shouldAutoOpen = data.state === "ok" && Boolean(actionMode) && !rewardWindowRequested && !dismissed;

    if (manuallyRequested || shouldAutoOpen) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [actionMode, data.state, dismissKey, manuallyRequested, rewardWindowRequested]);

  useEffect(() => {
    if (!open) return;
    const focusable = getFocusableElements(dialogRef.current);
    focusable[0]?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function replaceQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  function closeModal() {
    if (actionMode && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(dismissKey, "true");
    }
    setOpen(false);
    replaceQuery({ streak: null });
  }

  function openRewardWindow() {
    if (actionMode && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(dismissKey, "true");
    }
    replaceQuery({ streak: null, reward: "1" });
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-streak-title"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] border border-orange-400/20 bg-zinc-950 p-6 text-white shadow-2xl shadow-orange-950/40 motion-safe:animate-in motion-safe:slide-in-from-bottom-4 sm:rounded-[2rem]"
      >
        {fireGlow ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-orange-600/20 via-transparent to-transparent" />
            <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-orange-500/15 blur-3xl motion-safe:animate-pulse" />
          </>
        ) : null}

        <div className="relative mb-6 flex items-start justify-between gap-4 text-center">
          <div className="w-full">
            <h2 id="daily-streak-title" className="flex items-center justify-center gap-2 text-2xl font-black">
              <Flame className="h-6 w-6 fill-orange-500 text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.7)]" />
              Streak
            </h2>
            <p className="mt-1 text-sm text-zinc-400">One goal. Every day. Keep the fire alive.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={closeModal} aria-label="Close streak window" className="absolute right-0 top-0 text-zinc-300 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl">
          <div className="mb-5 flex items-center gap-2">
            <Target className="h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm font-semibold text-zinc-200">Daily Streak</p>
          </div>

          <div className="flex flex-col items-center py-4">
            <div className="relative">
              <span className="absolute inset-2 rounded-full bg-orange-500/25 blur-xl motion-safe:animate-pulse" aria-hidden="true" />
              <span className="absolute left-4 top-3 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.9)] motion-safe:animate-ping" aria-hidden="true" />
              <span className="absolute right-4 top-8 h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.9)] motion-safe:animate-pulse" aria-hidden="true" />
              <Flame
                className="relative h-20 w-20 fill-orange-500 text-orange-500"
                style={{ filter: fireGlow ? "drop-shadow(0 0 20px rgba(249,115,22,0.7))" : "none" }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-white">{streakNum}</span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-widest text-zinc-400">
              {streakNum === 1 ? "day streak" : "days streak"}
            </p>
          </div>

          <Button
            type="button"
            onClick={data.canClaimDailyReward || data.canRestoreStreak ? openRewardWindow : closeModal}
            className={`mt-4 h-14 w-full rounded-2xl text-base font-black transition-all ${
              checkedInToday
                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-800"
                : "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-600/30 hover:from-orange-400 hover:to-red-500 active:scale-95"
            }`}
          >
            {data.canRestoreStreak ? (
              <span className="flex items-center gap-2">
                <Flame className="h-5 w-5 fill-white/30" /> Restore streak
              </span>
            ) : data.canClaimDailyReward ? (
              <span className="flex items-center gap-2">
                <Flame className="h-5 w-5 fill-white/30" /> Open daily reward
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" /> Done today!
              </span>
            )}
          </Button>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Stat icon={<Trophy className="h-4 w-4 text-amber-400" />} label="Best" value={data.longestStreak || 0} />
            <Stat icon={<CalendarCheck className="h-4 w-4 text-emerald-400" />} label="Resets" value="8 AM" />
          </div>
        </div>

        <p className="relative mt-4 text-center text-xs leading-5 text-zinc-500">Daily streaks reset at 8:00 AM UTC+8.</p>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-zinc-800/50 py-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </div>
      <span className="mt-0.5 text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}
