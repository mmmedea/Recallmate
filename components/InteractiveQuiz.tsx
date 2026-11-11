"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, BookOpen, Sparkles, Trophy } from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
  sourceCitation: string;
  pageNumber: string;
}

interface QuizProps {
  fileName: string;
  summary: string;
  questions: {
    easy: Question[];
    medium: Question[];
    hard: Question[];
  };
}

const MOTIVATIONAL_WORDS = [
  "BOOM! 💥 Spot on!",
  "GWA-GWA! 🔥 You're on fire!",
  "WOHOO! 🎉 Nailed it!",
  "SUPERB! 🌟 Ace material!",
  "GENIUS MODE! 🧠 Perfect answer!",
];

export default function InteractiveQuiz({ fileName, summary, questions }: QuizProps) {
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const currentQuestions = questions[difficulty] || [];
  const currentQ = currentQuestions[currentIndex];

  const handleOptionSelect = (key: string) => {
    if (isSubmitted) return;
    setSelectedOption(key);
  };

  const handleSubmit = () => {
    if (!selectedOption || isSubmitted) return;
    setIsSubmitted(true);

    if (selectedOption === currentQ.correctAnswer) {
      setScore((prev) => prev + 1);
      const randomMotivation =
        MOTIVATIONAL_WORDS[Math.floor(Math.random() * MOTIVATIONAL_WORDS.length)];
      setToastMessage(randomMotivation);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsSubmitted(false);
    if (currentIndex < currentQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Motivational Toast Popup */}
      {toastMessage && (
        <div className="fixed top-10 right-10 z-50 animate-bounce bg-emerald-500 text-white font-bold px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white">
          <Sparkles className="w-6 h-6 animate-spin" />
          <span className="text-lg">{toastMessage}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-500" />
          {fileName}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm leading-relaxed">
          {summary}
        </p>
      </div>

      {/* Difficulty Selector */}
      <div className="flex gap-3 justify-center">
        {(["easy", "medium", "hard"] as const).map((level) => (
          <button
            key={level}
            onClick={() => {
              setDifficulty(level);
              setCurrentIndex(0);
              setSelectedOption(null);
              setIsSubmitted(false);
            }}
            className={`px-5 py-2.5 rounded-full text-sm font-bold capitalize transition-all ${
              difficulty === level
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {level} ({questions[level]?.length || 0})
          </button>
        ))}
      </div>

      {/* Question Card */}
      {currentQ ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-md transition-all space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold uppercase tracking-widest px-3 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full">
              Question {currentIndex + 1} of {currentQuestions.length}
            </span>
            <div className="flex items-center gap-1 text-sm font-bold text-amber-500">
              <Trophy className="w-4 h-4" /> Score: {score}
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
            {currentQ.question}
          </h2>

          {/* Multiple Choice Options */}
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(currentQ.options).map(([key, value]) => {
              const isSelected = selectedOption === key;
              const isCorrect = key === currentQ.correctAnswer;

              let btnStyle =
                "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-500";

              if (isSubmitted) {
                if (isCorrect) {
                  btnStyle =
                    "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold";
                } else if (isSelected && !isCorrect) {
                  btnStyle =
                    "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold";
                }
              } else if (isSelected) {
                btnStyle =
                  "bg-indigo-500/10 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-500/20";
              }

              return (
                <button
                  key={key}
                  disabled={isSubmitted}
                  onClick={() => handleOptionSelect(key)}
                  className={`flex items-center justify-between p-4 rounded-2xl border text-left text-sm transition-all duration-200 ${btnStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-xs">
                      {key}
                    </span>
                    <span>{value}</span>
                  </div>
                  {isSubmitted && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  {isSubmitted && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Submit / Next Controls */}
          {!isSubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg transition-all"
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
              {/* Correct Explanation & Source Page Citation */}
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Source Reference ({currentQ.pageNumber})
                </p>
                <blockquote className="text-xs italic text-slate-700 dark:text-slate-300 border-l-2 border-indigo-500 pl-3">
                  "{currentQ.sourceCitation}"
                </blockquote>
                <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
                  <span className="font-bold">Why it's correct:</span> {currentQ.explanation}
                </p>
              </div>

              {currentIndex < currentQuestions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-lg transition-all"
                >
                  Next Question →
                </button>
              ) : (
                <p className="text-center font-bold text-emerald-500 py-2">
                  🎉 Level Complete! Try switching difficulty above!
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-slate-500">No questions available for this level.</p>
      )}
    </div>
  );
}