"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import MathRenderer from "./MathRenderer";

interface ProgressiveNoteProps {
  title: string;
  content: string;
  difficulty?: "easy" | "medium" | "hard";
  index?: number;
}

export default function ProgressiveNote({
  title,
  content,
  difficulty = "easy",
  index,
}: ProgressiveNoteProps) {
  // PRD Benchmark: Collapse if content exceeds 500 characters
  const CHAR_LIMIT = 500;
  const isLong = content.length > CHAR_LIMIT;

  // PRD Exception: "Hard" flagged facts remain automatically expanded
  const autoExpand = difficulty === "hard" || !isLong;
  const [isExpanded, setIsExpanded] = useState(autoExpand);

  const displayContent = isExpanded ? content : `${content.substring(0, CHAR_LIMIT)}...`;

  return (
    <div
      className={`w-full mb-4 border rounded-3xl overflow-hidden transition-all duration-300 shadow-sm ${
        difficulty === "hard"
          ? "border-rose-500/40 bg-rose-950/20 dark:bg-rose-950/30"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60"
      }`}
    >
      {/* Clickable Header for One-Handed Mobile Use */}
      <div
        onClick={() => isLong && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-5 text-left ${
          isLong ? "cursor-pointer select-none" : ""
        }`}
      >
        <div className="flex items-center gap-3 pr-2">
          {typeof index === "number" && (
            <span className="flex-shrink-0 w-7 h-7 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold text-sm">
              {index + 1}
            </span>
          )}
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base md:text-lg">
            {title}
          </h3>

          {/* Gamified Tagging */}
          {difficulty === "hard" && (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10 rounded-full border border-rose-200 dark:border-rose-800/40">
              Hard Concept
            </span>
          )}
        </div>

        {isLong && (
          <button
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
            aria-label="Toggle content"
          >
            <ChevronDown
              className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {/* Dynamic Body Content */}
      <div className="px-5 pb-5">
        <MathRenderer
          content={displayContent}
          className="text-slate-700 dark:text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium"
        />

        {/* Progressive Disclosure Trigger */}
        {!isExpanded && isLong && (
          <button
            onClick={() => setIsExpanded(true)}
            className="mt-4 inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            Show More
          </button>
        )}
      </div>
    </div>
  );
}
