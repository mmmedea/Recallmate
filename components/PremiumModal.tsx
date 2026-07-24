"use client";

import { useState, FormEvent } from "react";
import { X, Lock, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function PremiumModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const unlockPremium = useAppStore((s) => s.unlockPremium);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (unlockPremium(password)) {
      setError("");
      setPassword("");
      onClose();
    } else {
      setError("Incorrect code. Try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
          <Sparkles className="h-6 w-6 text-white" />
        </div>

        <h2 className="text-lg font-bold text-gray-900">Unlock Premium</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter the premium code to get unlimited hearts and remove all limits.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:border-indigo-400">
            <Lock className="h-4 w-4 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter code"
              className="w-full text-sm outline-none"
            />
          </div>
          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}