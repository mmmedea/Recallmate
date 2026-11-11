"use client";

import { useState } from "react";
import { Eye, Check, X as XIcon } from "lucide-react";
import type { QAItem, Difficulty } from "@/lib/types";

const badgeColor: Record<Difficulty, string> = {
  easy: "bg-emerald-50 text-emerald-600",
  medium: "bg-amber-50 text-amber-600",
  hard: "bg-rose-50 text-rose-600"
};

export default function QuizCard({
  item,
  difficulty,
  onResult
}: {
  item: QAItem;
  difficulty: Difficulty;
  onResult: (correct: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeColor[difficulty]}`}>
        {difficulty}
      </span>
      <p className="mt-4 text-lg font-semibold text-gray-900">{item.question}</p>

      {revealed ? (
        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">{item.answer}</div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <Eye className="h-4 w-4" /> Reveal answer
        </button>
      )}

      {revealed && (
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onResult(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            <Check className="h-4 w-4" /> I knew it
          </button>
          <button
            onClick={() => onResult(false)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
          >
            <XIcon className="h-4 w-4" /> Missed it
          </button>
        </div>
      )}
    </div>
  );
}