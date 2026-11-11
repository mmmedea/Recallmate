"use client";

import type { QuizQuestionFormat } from "@/lib/quiz/schema";

const choices: Array<{ value: QuizQuestionFormat; title: string; detail: string }> = [
  { value: "multiple_choice", title: "Multiple choice", detail: "Choose one answer from four options" },
  { value: "identification", title: "Identification", detail: "Type the answer in your own words" },
  { value: "mixed", title: "Mixed", detail: "A balanced mix of both formats" },
];

export default function QuizFormatPicker({
  value,
  onChange,
}: {
  value: QuizQuestionFormat;
  onChange: (value: QuizQuestionFormat) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-2 text-sm font-black text-slate-900 dark:text-white">Choose question format</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={value === choice.value}
            onClick={() => onChange(choice.value)}
            className={`min-h-20 rounded-xl border px-4 py-3 text-left transition ${value === choice.value ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:bg-indigo-950/40" : "border-slate-200 hover:border-indigo-300 dark:border-slate-700"}`}
          >
            <span className="block font-black text-slate-900 dark:text-white">{choice.title}</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{choice.detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
