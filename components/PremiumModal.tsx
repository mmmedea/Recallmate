"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Lock, X } from "lucide-react";

export default function PremiumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const { setPremium } = useAppStore();

  if (!open) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === "PREMIUM2026" || code.trim() === "RECALLMATE") {
      setPremium(true);
      setError("");
      onClose();
    } else {
      setError("Invalid premium code.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Unlock Premium</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter the premium code to get unlimited hearts and remove all limits.
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
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold shadow-md transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}