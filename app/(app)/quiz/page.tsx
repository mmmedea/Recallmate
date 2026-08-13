"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QuizCard from "@/components/QuizCard";
import PremiumModal from "@/components/PremiumModal";
import { useAppStore } from "@/lib/store";
import { CheckCircle, RotateCcw, ArrowLeft, SlidersHorizontal, BookOpen } from "lucide-react";

export default function QuizPage() {
  const [content, setContent] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
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

  const questions = Array.isArray(content.questions) 
    ? content.questions 
    : (content.questions[content.difficulty || "easy"] || []);
    
  const current = questions[index];
  const outOfHearts = !isPremium && hearts <= 0;

  const handleResult = (correct: boolean) => {
    if (correct) {
      setScore(prev => prev + 1);
    } else {
      const ok = loseHeart();
      if (!ok) {
        setPremiumOpen(true);
        return;
      }
    }
    
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-8 px-4 transition-colors duration-200">
      
      {/* Top Header: Clean difficulty badge without distracting middle-quiz buttons */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-xs font-bold text-slate-400 uppercase">
          RecallMate Secure Quiz Session
        </span>
        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase rounded-full">
          Difficulty: {content.difficulty || "Mixed"}
        </span>
      </div>

      <h1 className="text-3xl font-black text-slate-900 dark:text-white">{content.fileName}</h1>
      <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">{content.summary}</p>

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
        ) : isFinished ? (
          /* COMPLETION SCREEN WITH POST-QUIZ RETURN OPTIONS */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-6 shadow-sm animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Quiz Completed!</h2>
            <p className="text-slate-600 dark:text-slate-400">
              You scored <span className="font-bold text-indigo-600 dark:text-indigo-400">{score}</span> out of <span className="font-bold">{questions.length}</span> correct.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
              <button
                onClick={() => { setIndex(0); setScore(0); setIsFinished(false); }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md"
              >
                <RotateCcw className="w-4 h-4" /> Try Again
              </button>
              
              <button
                onClick={() => {
                  sessionStorage.setItem("recallmate-reconfigure", "true");
                  router.push("/upload");
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <SlidersHorizontal className="w-4 h-4" /> Change Options & Difficulty
              </button>

              <button
                onClick={() => router.push("/notes")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <BookOpen className="w-4 h-4" /> Review Notes
              </button>
            </div>
          </div>
        ) : current ? (
          <div>
            <div className="flex justify-between items-center mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Question {index + 1} of {questions.length}</span>
              <span className="text-rose-500 dark:text-rose-400 font-semibold">🔒 Notes hidden during quiz</span>
            </div>
            <QuizCard item={current} difficulty={content.difficulty || "easy"} onResult={handleResult} />
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            No questions available.
          </p>
        )}
      </div>

      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </div>
  );
}