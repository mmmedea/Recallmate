"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Lock, X, Sparkles, CheckCircle2 } from "lucide-react";

export default function PremiumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { setPremium } = useAppStore();

  if (!open) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Strict match for the new code 030124
    if (code.trim() === "030124") {
      setPremium(true);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCode("");
        onClose();
      }, 1200);
    } else {
      setError("Invalid premium code. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Premium Unlocked!</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enjoy unlimited hearts and up to 50 questions per quiz.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2 mb-6">
              <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Unlock Premium</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter code <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">030124</span> to activate unlimited hearts and remove all limits.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code (e.g. 030124)"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold shadow-md transition-all active:scale-[0.98]"
              >
                Unlock Premium
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}