"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Flame, Heart, Gift, RotateCcw, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type EconomyAccount = {
  coins: number;
  hearts: number;
  heart_cap: number;
  current_streak: number;
  longest_streak: number;
  last_claimed_day: string | null;
  restore_available_for: string | null;
  study_day: string | null;
  restore_cost_coins: number;
};

const rewards = [
  { day: 1, reward: "+3 hearts" },
  { day: 2, reward: "+500 coins" },
  { day: 3, reward: "+5 hearts" },
  { day: 4, reward: "+1,000 coins" },
  { day: 5, reward: "+500 coins and +5 hearts" },
  { day: 6, reward: "+6 hearts" },
  { day: 7, reward: "+2,000 coins" },
];

export default function EconomyDashboard() {
  const [account, setAccount] = useState<EconomyAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error("Please sign in again to load your rewards.");
    return data.session.access_token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch("/api/economy/state", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your rewards.");
      setAccount(data.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your rewards.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (path: string, payload: Record<string, string>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...payload, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That action could not be completed.");
      if (data.account) setAccount(data.account);
      const status = data.result?.status;
      if (status === "restore_available") {
        setMessage("You missed one study day. Restore your streak for 200 coins to keep it going.");
      } else if (status === "claimed") {
        setMessage(`Daily reward claimed! +${data.result.coinsDelta || 0} coins and +${data.result.heartsDelta || 0} hearts.`);
      } else if (status === "restored") {
        setMessage("Your study streak has been restored.");
      } else if (status === "purchased") {
        setMessage("Your hearts have been added.");
      } else if (status === "already_claimed_today") {
        setMessage("You've already claimed today's reward.");
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

  return (
    <section className="mb-8 space-y-4" aria-label="Study rewards and progress">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 p-5 shadow-sm dark:border-amber-900/60 dark:from-amber-950/50 dark:to-slate-900">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300"><Coins className="h-5 w-5" /><span className="text-sm font-semibold">Your coins</span></div>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{loading ? "…" : (account?.coins ?? 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Use coins to restore streaks and get extra hearts.</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-100 p-5 shadow-sm dark:border-rose-900/60 dark:from-rose-950/50 dark:to-slate-900">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300"><Heart className="h-5 w-5 fill-current" /><span className="text-sm font-semibold">Hearts</span></div>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{loading ? "…" : `${account?.hearts ?? 0} ♥`}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">15 is the standard cap. Earned hearts can overflow it.</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100 p-5 shadow-sm dark:border-orange-900/60 dark:from-orange-950/50 dark:to-slate-900">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300"><Flame className="h-5 w-5" /><span className="text-sm font-semibold">Study streak</span></div>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{loading ? "…" : `${account?.current_streak ?? 0} days`}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Longest streak: {loading ? "…" : account?.longest_streak ?? 0} days</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-900/60 dark:bg-slate-900">
          <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /><h2 className="font-bold text-slate-900 dark:text-white">Daily rewards</h2></div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your reward day resets at 8:00 AM Philippines time.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rewards.map((item) => (
              <div key={item.day} className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/50">
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300">DAY {item.day}</p>
                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">{item.reward}</p>
              </div>
            ))}
          </div>
          {canClaim && (
            <button type="button" disabled={busy || loading} onClick={() => void mutate("/api/economy/daily-reward", {})} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Gift className="h-4 w-4" /> Claim today's reward
            </button>
          )}
          {canRestore && (
            <button type="button" disabled={busy || loading} onClick={() => void mutate("/api/economy/restore-streak", {})} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
              <RotateCcw className="h-4 w-4" /> Restore streak · 200 coins
            </button>
          )}
          {!canClaim && !canRestore && account?.last_claimed_day === account?.study_day && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Today's reward has already been claimed. Come back after 8:00 AM tomorrow.</p>
          )}
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-rose-600 dark:text-rose-300" /><h2 className="font-bold text-slate-900 dark:text-white">Heart shop</h2></div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Spend your coins to keep studying.</p>
          <div className="mt-4 space-y-3">
            <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 200} onClick={() => void mutate("/api/economy/heart-shop", { kind: "add_five" })} className="flex w-full items-center justify-between rounded-xl border border-rose-100 px-4 py-3 text-left transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/50 dark:hover:bg-rose-950/40">
              <span><span className="block text-sm font-bold text-slate-900 dark:text-white">Add 5 hearts</span><span className="text-xs text-slate-500">Can go over the 15-heart cap</span></span>
              <span className="text-sm font-black text-amber-600">200 🪙</span>
            </button>
            <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 500 || (account?.hearts ?? 0) >= 15} onClick={() => void mutate("/api/economy/heart-shop", { kind: "refill_to_cap" })} className="flex w-full items-center justify-between rounded-xl border border-rose-100 px-4 py-3 text-left transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/50 dark:hover:bg-rose-950/40">
              <span><span className="block text-sm font-bold text-slate-900 dark:text-white">Refill to 15 hearts</span><span className="text-xs text-slate-500">Available when below 15 hearts</span></span>
              <span className="text-sm font-black text-amber-600">500 🪙</span>
            </button>
          </div>
        </div>
      </div>

      {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      {loading && <p className="text-xs text-slate-500">Loading your saved rewards…</p>}
    </section>
  );
}
