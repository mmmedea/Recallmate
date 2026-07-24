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

  const questions = content.questions[difficulty];
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
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      setIndex(0);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-bold text-gray-900">{content.fileName}</h1>
      <p className="mt-1 text-sm text-gray-500">{content.summary}</p>

      <div className="mt-6 flex gap-2">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDifficulty(d);
              setIndex(0);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
              difficulty === d ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {outOfHearts ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-8 text-center">
            <p className="font-semibold text-rose-600">You're out of hearts</p>
            <p className="mt-1 text-sm text-rose-400">
              Wait for a heart to regenerate, or unlock premium for unlimited hearts.
            </p>
            <button
              onClick={() => setPremiumOpen(true)}
              className="mt-4 rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600"
            >
              Go Premium
            </button>
          </div>
        ) : (
          <QuizCard item={current} difficulty={difficulty} onResult={handleResult} />
        )}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-gray-700">Notes</p>
        <ul className="space-y-1.5 text-sm text-gray-500">
          {content.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-indigo-400">•</span>
              {n}
            </li>
          ))}
        </ul>
      </div>

      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </div>
  );
}