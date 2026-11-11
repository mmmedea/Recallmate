"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/lib/store";
import { Lock, X, Sparkles, CheckCircle2 } from "lucide-react";

export default function PremiumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { unlockPremium } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const isSuccess = unlockPremium(code);

    if (isSuccess) {
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

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner">
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
                Enter your secret access code to activate unlimited hearts and remove all limits.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-center">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold shadow-md transition-all text-sm active:scale-[0.98]"
                >
                  Unlock Premium
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