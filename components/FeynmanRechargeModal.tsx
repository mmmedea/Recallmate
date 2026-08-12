"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/lib/store";
import { Heart, X, Brain, ArrowRight } from "lucide-react";

interface FeynmanRechargeModalProps {
  open: boolean;
  onClose: () => void;
  topic?: string;
}

export default function FeynmanRechargeModal({
  open,
  onClose,
  topic = "a key concept from your material",
}: FeynmanRechargeModalProps) {
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { addHeart } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const [loading, setLoading] = useState(false);
  const [earnedCount, setEarnedCount] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (explanation.trim().length < 25) {
      setError("Please write at least 25 characters to synthesize the concept clearly.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFeynmanEvaluation: true,
          messages: [{ role: "user", content: `Concept: ${topic}\nExplanation: ${explanation}` }],
        }),
      });

      const data = await res.json();
      let heartsToReward = 1;

      if (data.content) {
        const match = data.content.match(/"heartsEarned":\s*([1-3])/);
        if (match) {
          heartsToReward = parseInt(match[1], 10);
        }
      }

      addHeart(heartsToReward);
      setEarnedCount(heartsToReward);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        setExplanation("");
        setLoading(false);
        onClose();
      }, 2000);
    } catch (err) {
      // Fallback: award 1 heart if network fails
      addHeart(1);
      setEarnedCount(1);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setExplanation("");
        setLoading(false);
        onClose();
      }, 1500);
    }
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Prominent Close X Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center shadow-inner">
              <Heart className="w-8 h-8 fill-rose-500 text-rose-500 animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              +{earnedCount} {earnedCount === 1 ? "Heart" : "Hearts"} Earned!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
              Great active synthesis! You've recharged a heart through the Feynman Technique.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6 pr-8">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-full border border-rose-200 dark:border-rose-800/40">
                  Feynman Heart Recharge
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Explain It Simply
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Out of hearts? Recharge +1 Heart immediately by explaining <span className="font-semibold text-slate-900 dark:text-slate-200">"{topic}"</span> as if teaching it to a beginner.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="In simple terms, this concept works by..."
                  rows={4}
                  autoFocus
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm transition-colors resize-none"
                />
                <div className="flex justify-between items-center mt-1.5 px-1">
                  <span className="text-[11px] text-slate-400">
                    {explanation.trim().length} / 25 min chars
                  </span>
                  <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-rose-500" /> +1 Heart reward
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-center">
                  {error}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-2/3 py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
                >
                  Synthesize & Recharge <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

