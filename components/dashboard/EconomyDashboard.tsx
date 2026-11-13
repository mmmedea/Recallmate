"use client";

import { useCallback, useEffect, useState } from "react";

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
      const response = await fetch("/api/economy/state", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your study streak.");
      setAccount(data.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your study streak.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (path: string, payload: Record<string, string> = {}) => {
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
      if (status === "claimed") {
        setMessage(`Reward claimed! +${data.result.coinsDelta || 0} coins and +${data.result.heartsDelta || 0} hearts.`);
        setOpen(false);
      } else if (status === "restored") {
        setMessage("Your streak is back. Keep the momentum going!");
        setOpen(false);
      } else if (status === "purchased") {
        setMessage("Your hearts have been added.");
      } else if (status === "already_claimed_today") {
        setMessage("Today's reward has already been claimed.");
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="streak-fire inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-400/20 to-red-500/10 text-2xl" aria-hidden="true">🔥</span>
        <div>
          <p className="font-fredoka text-sm font-semibold text-white">{loading ? "Checking your streak…" : `${account?.current_streak ?? 0} day study streak`}</p>
          <p className="font-quicksand text-xs text-white/45">{loading ? "Your study momentum" : `Next reward: Day ${nextRewardDay} · ${nextReward}`}</p>
        </div>
      </div>
      <button type="button" disabled={loading} onClick={() => setOpen(true)} className="rounded-xl border border-orange-400/25 bg-orange-400/10 px-4 py-2.5 font-nunito text-xs font-extrabold text-orange-200 transition hover:border-orange-300/60 hover:bg-orange-400/20 disabled:opacity-50">
        View streak awards →
      </button>

      {message && <p role="status" className="w-full rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 font-nunito text-sm text-emerald-200">{message}</p>}
      {error && <p role="alert" className="w-full rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 font-nunito text-sm text-rose-200">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="daily-reward-title" className="streak-modal relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-orange-400/30 bg-[#151019] p-5 shadow-[0_0_100px_rgba(249,115,22,0.16)] sm:p-7">
            <div aria-hidden="true" className="streak-orb pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="font-pixelify text-[10px] uppercase tracking-[0.22em] text-orange-300">KEEP THE FIRE ALIVE</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="streak-fire text-4xl" aria-hidden="true">🔥</span>
                  <h2 id="daily-reward-title" className="font-fredoka text-3xl font-semibold text-white">Your streak</h2>
                </div>
                <p className="mt-2 font-quicksand text-sm text-white/55">Show up, study a little, and build momentum one day at a time.</p>
              </div>
              <button type="button" aria-label="Close streak awards" disabled={busy} onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-1.5 font-nunito text-lg text-white/60 transition hover:border-orange-300/40 hover:text-white disabled:opacity-40">×</button>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {rewards.map((item) => (
                <div key={item.day} className={`rounded-2xl border p-3 transition ${nextRewardDay === item.day ? "border-orange-400/60 bg-orange-400/15 shadow-[0_0_24px_rgba(249,115,22,0.12)]" : "border-white/10 bg-white/[0.03]"}`}>
                  <p className="font-pixelify text-[10px] tracking-widest text-orange-300">DAY {item.day}</p>
                  <p className="mt-2 font-nunito text-sm font-extrabold text-white">{item.reward}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-5 grid grid-cols-3 gap-2">
              <WalletTile label="Coins" value={loading ? "…" : account?.coins.toLocaleString() ?? "—"} tone="amber" />
              <WalletTile label="Hearts" value={loading ? "…" : String(account?.hearts ?? "—")} tone="rose" />
              <WalletTile label="Day streak" value={loading ? "…" : String(account?.current_streak ?? "—")} tone="orange" />
            </div>

            {canClaim && <button type="button" disabled={busy || loading} onClick={() => void mutate("/api/economy/daily-reward")} className="relative mt-5 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3.5 font-nunito text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:shadow-orange-500/30 disabled:opacity-50">{busy ? "Claiming…" : "Claim today's reward"}</button>}
            {canRestore && <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 200} onClick={() => void mutate("/api/economy/restore-streak")} className="relative mt-5 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3.5 font-nunito text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? "Restoring…" : "Restore missed streak · 200 coins"}</button>}
            {!canClaim && !canRestore && account?.last_claimed_day === account?.study_day && <p className="relative mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center font-nunito text-sm font-bold text-emerald-200">Today's reward is already claimed. Come back after 8:00 AM (UTC+8).</p>}

            <div className="relative mt-6 border-t border-white/10 pt-5">
              <p className="font-fredoka text-lg font-semibold text-white">Heart shop</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 200} onClick={() => void mutate("/api/economy/heart-shop", { kind: "add_five" })} className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-3 text-left font-nunito text-sm font-extrabold text-white transition hover:bg-rose-400/10 disabled:opacity-40">+5 hearts <span className="mt-1 block text-xs font-semibold text-orange-200/70">200 coins · overflow allowed</span></button>
                <button type="button" disabled={busy || loading || (account?.coins ?? 0) < 500 || (account?.hearts ?? 0) >= 15} onClick={() => void mutate("/api/economy/heart-shop", { kind: "refill_to_cap" })} className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-3 text-left font-nunito text-sm font-extrabold text-white transition hover:bg-rose-400/10 disabled:opacity-40">Refill to 15 hearts <span className="mt-1 block text-xs font-semibold text-orange-200/70">500 coins</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletTile({ label, value, tone }: { label: string; value: string; tone: "amber" | "rose" | "orange" }) {
  const tones = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-200",
    orange: "border-orange-300/20 bg-orange-300/10 text-orange-200",
  };
  return <div className={`rounded-xl border p-3 text-center ${tones[tone]}`}><p className="font-fredoka text-xl font-semibold text-white">{value}</p><p className="font-nunito text-[10px] font-bold">{label}</p></div>;
}
