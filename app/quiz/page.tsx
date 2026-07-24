"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QuizCard from "@/components/QuizCard";
import PremiumModal from "@/components/PremiumModal";
import { useAppStore } from "@/lib/store";
import type { GeneratedContent, Difficulty } from "@/lib/types";

export default function QuizPage() {
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [index, setIndex] = useState(0);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const { hearts, isPremium, loseHeart } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("recallmate-content");
    if (!raw) {
      router.push("/upload");
      return;
    }
    setContent(JSON.parse(raw));
  }, [router]);

  if (!content) return null;

  const questions = content.questions[difficulty] || [];
  const current = questions[index];
  const outOfHearts = !isPremium && hearts <= 0;

  const handleResult = (correct: boolean) => {
    if (!correct) {
      const ok = loseHeart();
      if (!ok) {
        setPremiumOpen(true);
        return;
      }
    }
    
    // Move to next question or loop back
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      setIndex(0); // Alternatively, you could route to a "Results" page here
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-8 px-4 transition-colors duration-200">
      
      {/* FIXED VISIBILITY: Replaced text-gray-900 with slate-900/white */}
      <h1 className="text-3xl font-black text-slate-900 dark:text-white">{content.fileName}</h1>
      <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">{content.summary}</p>

      {/* Difficulty Tabs */}
      <div className="mt-6 flex gap-2">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDifficulty(d);
              setIndex(0);
            }}
            className={`rounded-full px-5 py-2 text-sm font-bold capitalize transition-all ${
              difficulty === d 
                ? "bg-indigo-600 text-white dark:bg-indigo-500" 
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {outOfHearts ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/50 p-8 text-center shadow-sm">
            <p className="font-bold text-lg text-rose-600 dark:text-rose-400">You're out of hearts</p>
            <p className="mt-2 text-sm text-rose-500 dark:text-rose-300">
              Wait for a heart to regenerate, or unlock premium for unlimited hearts.
            </p>
            <button
              onClick={() => setPremiumOpen(true)}
              className="mt-6 rounded-xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-600 shadow-sm"
            >
              Go Premium
            </button>
          </div>
        ) : current ? (
          <QuizCard item={current} difficulty={difficulty} onResult={handleResult} />
        ) : (
          <p className="text-slate-500 dark:text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            No questions available for this difficulty.
          </p>
        )}
      </div>

      {/* FIXED VISIBILITY: Notes Section */}
      <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
        <p className="mb-4 text-xl font-black text-slate-900 dark:text-white">Extracted Notes</p>
        <ul className="space-y-3 text-sm md:text-base text-slate-700 dark:text-slate-300">
          {content.notes.map((n, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
              <span className="leading-relaxed">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </div>
  );
}