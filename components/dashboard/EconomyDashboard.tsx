"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, RotateCcw, Flame, X, Coins, Heart } from "lucide-react";

type EconomyAccount = {
  coins: number;
  hearts: number;
  heart_cap: number;
  current_streak: number;
  longest_streak: number;
  last_claimed_day: string | null;
  restore_available_for: string | null;
  study_day: string | null;
};

const rewards = [
  { day: 1, reward: "+3 hearts" },
  { day: 2, reward: "+500 coins" },
  { day: 3, reward: "+5 hearts" },
  { day: 4, reward: "+1,000 coins" },
  { day: 5, reward: "+500 coins +5 hearts" },
  { day: 6, reward: "+6 hearts" },
  { day: 7, reward: "+2,000 coins" },
];

export default function EconomyDashboard() {
  const [account, setAccount] = useState<EconomyAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/economy/state", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your rewards.");
      setAccount(data.account);
      if (data.account?.restore_available_for || (data.account?.study_day && data.account?.last_claimed_day !== data.account?.study_day)) {
        setOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your rewards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (path: string, payload: Record<string, string>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That action could not be completed.");
      if (data.account) setAccount(data.account);
      window.dispatchEvent(new Event("economy:updated"));
      const status = data.result?.status;
      if (status === "restore_available") {
        setMessage("You missed one study day. Restore your streak for 200 coins to keep it going.");
        setOpen(true);
      } else if (status === "claimed") {
        setMessage(`Daily reward claimed! +${data.result.coinsDelta || 0} coins and +${data.result.heartsDelta || 0} hearts.`);
        setOpen(false);
      } else if (status === "restored") {
        setMessage("Your study streak has been restored.");
        setOpen(false);
      } else if (status === "purchased") {
        setMessage("Your hearts have been added.");
      } else if (status === "already_claimed_today") {
        setMessage("You've already claimed today's reward.");
        setOpen(false);
      } else {
        setMessage("Your rewards have been updated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const canClaim = Boolean(account && account.last_claimed_day !== account.study_day && !account.restore_available_for);
  const canRestore = Boolean(account?.restore_available_for);
  const nextRewardDay = account ? (account.current_streak % 7) + 1 : 1;
  const nextReward = rewards.find((reward) => reward.day === nextRewardDay)?.reward;

  return (
    <section className="mb-6" aria-label="Daily study reward">
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-4 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-slate-900 dark:to-violet-950/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200"><Gift className="h-5 w-5" /></div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Daily reward</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{loading ? "Checking your streak…" : `Day ${nextRewardDay} reward: ${nextReward}`} · Resets at 8:00 AM (UTC+8)</p>
          </div>
        </div>
        <button type="button" disabled={loading} onClick={() => setOpen(true)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
          {canRestore ? "Restore streak" : canClaim ? "Claim reward" : "View rewards"}
        </button>
      </div>

      {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="daily-reward-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-indigo-200 bg-white p-5 shadow-2xl dark:border-indigo-900 dark:bg-slate-900 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Keep your momentum</p><h2 id="daily-reward-title" className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Daily streak rewards</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Check in every study day. Your day resets at 8:00 AM Philippines time.</p></div>
              <button type="button" aria-label="Close daily rewards" disabled={busy} onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {rewards.map((item) => (
                <div key={item.day} className={`rounded-xl border p-3 ${nextRewardDay === item.day ? "border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/60" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"}`}>
                  <p className="text-xs font-black text-indigo-600 dark:text-indigo-300">DAY {item.day}</p><p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.reward}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-950/40"><Coins className="mx-auto h-4 w-4 text-amber-600" /><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{loading ? "…" : account?.coins.toLocaleString()}</p><p className="text-[11px] text-slate-500">Coins</p></div>
              <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-950/40"><Heart className="mx-auto h-4 w-4 text-rose-600" /><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{loading ? "…" : account?.hearts}</p><p className="text-[11px] text-slate-500">Hearts</p></div>
              <div className="rounded-xl bg-orange-50 p-3 text-center dark:bg-orange-950/40"><Flame className="mx-auto h-5 w-5 fill-orange-500 text-orange-600 motion-safe:animate-[streak-flame_1.5s_ease-in-out_infinite]" /><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{loading ? "…" : account?.current_streak}</p><p className="text-[11px] text-slate-500">Day streak</p></div>
            </div>

            {canClaim && <button type="button" disabled={busy || loading} onClick={() => void mutate("/api/economy/daily-reward", {})} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Processing…" : "Claim today's reward"}</button>}
            {canRestore && <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 200} onClick={() => void mutate("/api/economy/restore-streak", {})} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" />{busy ? "Restoring…" : "Restore streak · 200 coins"}</button>}
            {!canClaim && !canRestore && account?.last_claimed_day === account?.study_day && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Today's reward is already claimed. Come back after 8:00 AM tomorrow.</p>}

            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Heart shop</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 200} onClick={() => void mutate("/api/economy/heart-shop", { kind: "add_five" })} className="rounded-xl border border-rose-200 px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:text-slate-100 dark:hover:bg-rose-950/40">+5 hearts <span className="block text-xs font-normal text-amber-600">200 coins · overflow allowed</span></button>
                <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 500 || (account?.hearts ?? 0) >= 15} onClick={() => void mutate("/api/economy/heart-shop", { kind: "refill_to_cap" })} className="rounded-xl border border-rose-200 px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:text-slate-100 dark:hover:bg-rose-950/40">Refill to 15 hearts <span className="block text-xs font-normal text-amber-600">500 coins</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
