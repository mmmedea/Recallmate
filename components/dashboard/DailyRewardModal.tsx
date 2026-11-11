"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DailyRewardActions } from "@/components/dashboard/DailyRewardActions";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/dashboard/get-dashboard-data";
import { getRewardForStreak } from "@/lib/economy/rules";

export function DailyRewardModal({ data }: { data: DashboardData["economy"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [successPayload, setSuccessPayload] = useState<any>(null);
  const rewardDayKey = data.studyDay ?? "unknown-day";
  const claimedKey = `recallmate:daily-reward-claimed:${rewardDayKey}`;
  const [claimedInBrowser, setClaimedInBrowser] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(claimedKey) === "true",
  );
  const actionMode = data.canRestoreStreak ? "restore" : data.canClaimDailyReward && !claimedInBrowser ? "claim" : null;
  const dismissKey = `recallmate:daily-reward-dismissed:${rewardDayKey}:${actionMode ?? "none"}`;
  const manuallyRequested = searchParams.get("reward") === "1";

  useEffect(() => {
    setSuccessPayload(null);
    setClaimedInBrowser(typeof localStorage !== "undefined" && localStorage.getItem(claimedKey) === "true");
  }, [claimedKey]);

  useEffect(() => {
    if (actionMode && manuallyRequested) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    } else if (!manuallyRequested) {
      setOpen(false);
    }
  }, [actionMode, manuallyRequested]);

  useEffect(() => {
    if (!open) return;
    const focusable = getFocusableElements(dialogRef.current);
    focusable[0]?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!successPayload) return;
    const timeout = window.setTimeout(() => {
      setOpen(false);
      replaceQuery({ reward: null });
    }, 1600);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successPayload]);

  if (!open) return null;

  const currentStreak = Math.max(1, data.streak || 1);
  const reward = getRewardForStreak(currentStreak);
  const nextReward = getRewardForStreak(currentStreak + 1);
  const rewardParts = [
    reward.hearts > 0 ? `❤️ +${reward.hearts}` : null,
    reward.coins > 0 ? `🪙 +${reward.coins.toLocaleString()}` : null,
  ].filter(Boolean);
  const nextParts = [
    nextReward.hearts > 0 ? `❤️ +${nextReward.hearts}` : null,
    nextReward.coins > 0 ? `🪙 +${nextReward.coins.toLocaleString()}` : null,
  ].filter(Boolean);

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
    replaceQuery({ reward: null });
  }

  function handleRewardSuccess(payload: any) {
    if (!data.canRestoreStreak && typeof localStorage !== "undefined") {
      localStorage.setItem(claimedKey, "true");
      setClaimedInBrowser(true);
    }
    setSuccessPayload(payload);
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reward-title"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-lg rounded-t-[2rem] border border-violet-200 bg-white p-6 shadow-2xl shadow-violet-500/20 motion-safe:animate-in motion-safe:slide-in-from-bottom-4 dark:border-violet-400/25 dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">Daily reward</p>
            <h2 id="daily-reward-title" className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {data.canRestoreStreak ? "Restore streak" : "Check in today"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-black text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200">
              🔥 {data.streak}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closeModal} aria-label="Close daily reward">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {successPayload ? (
          <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-500/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
              {data.canRestoreStreak ? "Streak restored" : "Reward claimed"}
            </p>
            <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{rewardParts.join(" + ") || "Done"}</p>
            {successPayload?.economy ? (
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Your balance is now {successPayload.economy.hearts}/{successPayload.economy.heartCap} hearts and {Number(successPayload.economy.coins ?? 0).toLocaleString()} coins.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[1.5rem] border border-violet-200 bg-violet-50 p-5 dark:border-violet-400/20 dark:bg-violet-500/10">
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">{data.streak}-day streak</p>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Today's reward</p>
              <p className="mt-1 text-4xl font-black text-slate-950 dark:text-white">{rewardParts.join(" + ") || "Keep streak"}</p>
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Next: {nextParts.join(" + ") || "Keep streak"}</p>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Resets at 8:00 AM UTC+8.</p>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {data.canRestoreStreak
                ? "You missed exactly one day. Restore your streak without claiming the missed reward."
                : "Keep your streak going and collect today's reward."}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11 rounded-2xl" onClick={closeModal}>
                Not now
              </Button>
              <DailyRewardActions canRestore={data.canRestoreStreak} restoreCostCoins={data.restoreCostCoins} onSuccess={handleRewardSuccess} />
            </div>
          </>
        )}
      </section>
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
