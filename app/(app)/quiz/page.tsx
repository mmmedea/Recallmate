"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuizCard from "@/components/QuizCard";
import PremiumModal from "@/components/PremiumModal";
import { DiamondLoader } from "@/components/DiamondLoader";
import { CheckCircle, RotateCcw, SlidersHorizontal, BookOpen } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

type WalletState = {
  economy: {
    coins: number;
    hearts: number;
    heartCap: number;
    state: "ok" | "unavailable";
  };
  premium: boolean;
};

export default function QuizPage() {
  const [content, setContent] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [heartPurchasePending, setHeartPurchasePending] = useState<string | null>(null);
  const answerRequestIds = useRef(new Map<number, string>());
  const router = useRouter();

  async function loadWallet() {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const response = await fetch("/api/economy/wallet", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/login?next=/quiz");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not load your hearts.");
      setWallet(payload);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Could not load your hearts.");
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("recallmate-content");
    if (!raw) {
      router.push("/upload");
      return;
    }
    setContent(JSON.parse(raw));
  }, [router]);

  useEffect(() => {
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!content) return null;

  const questions = Array.isArray(content.questions) 
    ? content.questions 
    : (content.questions[content.difficulty || "easy"] || []);
    
  const current = questions[index];
  const quizExhausted = Boolean(content.quizEngine?.exhausted);
  const economy = wallet?.economy;
  const isPremium = wallet?.premium ?? false;
  const outOfHearts = !walletLoading && !isPremium && economy?.state === "ok" && economy.hearts <= 0;
  const walletUnavailable = !walletLoading && (!wallet || walletError || economy?.state !== "ok");

  const buyHearts = async (kind: "add_five" | "refill_to_cap") => {
    setHeartPurchasePending(kind);
    setWalletError(null);
    try {
      const response = await fetch("/api/economy/heart-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          idempotencyKey: `quiz-heart-shop:${kind}:${crypto.randomUUID()}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not buy hearts.");
      await loadWallet();
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Could not buy hearts.");
    } finally {
      setHeartPurchasePending(null);
    }
  };

  const handleResult = async (correct: boolean) => {
    setAnswerError(null);

    // The old upload quiz is still supported, but its heart mutation must go
    // through the same server-authoritative ledger as the newer FSRS route.
    // Keep one request id per question so a retry cannot charge twice.
    if (!correct && !isPremium) {
      const requestId = answerRequestIds.current.get(index) ?? uuidv4();
      answerRequestIds.current.set(index, requestId);

      try {
        const response = await fetch("/api/economy/quiz-wrong-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          await loadWallet();
          throw new Error(payload?.error || "Could not save the heart update.");
        }

        const result = payload?.result;
        if (result && wallet?.economy?.state === "ok" && Number.isFinite(Number(result.hearts))) {
          setWallet((previous) => previous ? {
            ...previous,
            economy: { ...previous.economy, hearts: Number(result.hearts) },
          } : previous);
          window.dispatchEvent(new CustomEvent("recallmate:economy-updated", {
            detail: { hearts: Number(result.hearts), heartCap: Number(result.heartCap ?? economy?.heartCap ?? 15) },
          }));
        }
        // Refresh in the background so any regen or server-side entitlement
        // changes are reflected without making the student wait.
        void loadWallet();
      } catch (error) {
        setAnswerError(error instanceof Error ? error.message : "Could not save the heart update.");
        return;
      }
    }

    if (correct) {
      setScore(prev => prev + 1);
    }
    
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-8 px-4 transition-colors duration-200">
      
      {/* Top Header: Clean difficulty badge without distracting middle-quiz buttons */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-xs font-bold text-slate-400 uppercase">
          RecallMate Secure Quiz Session
        </span>
        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase rounded-full">
          Difficulty: {content.difficulty || "Mixed"}
        </span>
      </div>

      <h1 className="text-3xl font-black text-slate-900 dark:text-white">{content.fileName}</h1>
      <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">{content.summary}</p>
      {quizExhausted ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          {content.notice ||
            "RecallMate used every unique source-grounded question it could safely validate. It did not repeat or invent extra questions."}
        </div>
      ) : null}

      <div className="mt-8">
        {walletLoading ? (
          <DiamondLoader
            variant="section"
            label="Loading your quiz access"
            sublabel="Checking your hearts and premium status"
            className="min-h-48 rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ) : walletUnavailable ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="font-bold text-lg text-amber-700 dark:text-amber-300">Could not load your hearts</p>
            <p className="mt-2 text-sm text-amber-700/80 dark:text-amber-200/80">
              {walletError || "Your wallet is temporarily unavailable. Retry before starting the quiz."}
            </p>
            <button
              onClick={() => void loadWallet()}
              className="mt-6 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
            >
              Retry
            </button>
          </div>
        ) : isFinished ? (
          /* COMPLETION SCREEN WITH POST-QUIZ RETURN OPTIONS */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-6 shadow-sm animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Quiz Completed!</h2>
            <p className="text-slate-600 dark:text-slate-400">
              You scored <span className="font-bold text-indigo-600 dark:text-indigo-400">{score}</span> out of <span className="font-bold">{questions.length}</span> correct.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
              <button
                onClick={() => { setIndex(0); setScore(0); setIsFinished(false); answerRequestIds.current.clear(); }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md"
              >
                <RotateCcw className="w-4 h-4" /> Try Again
              </button>

              <button
                onClick={() => {
                  sessionStorage.setItem("recallmate-reconfigure", "true");
                  router.push("/upload");
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <SlidersHorizontal className="w-4 h-4" /> Change Options & Difficulty
              </button>

              <button
                onClick={() => router.push("/notes")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <BookOpen className="w-4 h-4" /> Review Notes
              </button>
            </div>
          </div>
        ) : outOfHearts ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/50 p-8 text-center shadow-sm">
            <p className="font-bold text-lg text-rose-600 dark:text-rose-400">You're out of hearts</p>
            <p className="mt-2 text-sm text-rose-500 dark:text-rose-300">
              Buy hearts with coins or unlock premium for unlimited quiz attempts.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => void buyHearts("add_five")}
                disabled={heartPurchasePending !== null}
                className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-600 disabled:opacity-60"
              >
                ❤️ +5 hearts · 200 coins
              </button>
              <button
                onClick={() => void buyHearts("refill_to_cap")}
                disabled={heartPurchasePending !== null || Boolean(economy && economy.hearts >= economy.heartCap)}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                Refill to 15 · 500 coins
              </button>
              <button
                onClick={() => setPremiumOpen(true)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950"
              >
                Go Premium
              </button>
            </div>
          </div>
        ) : current ? (
          <div>
            <div className="flex justify-between items-center mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Question {index + 1} of {questions.length}</span>
              <span className="text-rose-500 dark:text-rose-400 font-semibold">🔒 Notes hidden during quiz</span>
            </div>
            {answerError ? (
              <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {answerError}
              </div>
            ) : null}
            <QuizCard item={current} difficulty={current.difficulty || content.difficulty || "easy"} onResult={handleResult} />
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <p className="text-lg font-black text-slate-800 dark:text-white">All unique useful questions are exhausted.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6">
              RecallMate could not safely validate more source-grounded questions without repeating or inventing details.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/upload")}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                Generate deeper applications
              </button>
              <button
                onClick={() => router.push("/notes")}
                className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Practice from notes
              </button>
            </div>
          </div>
        )}
      </div>

      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </div>
  );
}
