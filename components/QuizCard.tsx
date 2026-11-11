"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";

export default function QuizCard({ item, difficulty, onResult }: any) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  // Instantly reset the selected answer whenever a new question is passed in
  useEffect(() => {
    setSelectedChoice(null);
  }, [item.id]);

  const isAnswered = selectedChoice !== null;
  const isCorrect = selectedChoice === item.correctAnswer;

  const handleSelect = (key: string) => {
    if (isAnswered) return; // Prevent changing answer
    setSelectedChoice(key);
  };

  const handleNext = () => {
    if (!isAnswered) return;
    onResult(isCorrect); // Tells the parent page to subtract a heart if wrong, and move to next question
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm transition-colors">
      
      {/* Badge & Question */}
      <div className="mb-6">
        <span className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full mb-4 ${
          difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' :
          difficulty === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
          'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
        }`}>
          {difficulty}
        </span>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
          {item.question}
        </h3>
      </div>

      {/* Multiple Choice Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {Object.entries(item.options || {}).map(([key, value]) => {
          let btnStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-slate-800";

          if (isAnswered) {
            if (key === item.correctAnswer) {
              btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-500 dark:text-emerald-300";
            } else if (key === selectedChoice) {
              btnStyle = "bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950/30 dark:border-rose-500 dark:text-rose-300";
            } else {
              btnStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 cursor-not-allowed";
            }
          }

          return (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={isAnswered}
              className={`text-left w-full p-4 rounded-xl border-2 transition-all font-medium flex items-start gap-3 ${btnStyle}`}
            >
              <span className="font-black mt-0.5">{key}.</span>
              <span className="flex-1">{String(value)}</span>
              {isAnswered && key === item.correctAnswer && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
              {isAnswered && key === selectedChoice && key !== item.correctAnswer && <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Explanation & Next Button (Revealed only after answering) */}
      {isAnswered && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`p-5 rounded-2xl border ${isCorrect ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50'}`}>
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className={`w-5 h-5 mt-0.5 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
              <div>
                <span className={`font-bold block ${isCorrect ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                  {isCorrect ? "Correct!" : "Incorrect."}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {item.explanation}
                </p>
              </div>
            </div>
            {item.sourceCitation && (
              <div className="mt-3 ml-7 pl-3 border-l-2 border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 italic">
                "{item.sourceCitation}" — {item.pageNumber}
              </div>
            )}
          </div>
          
          <button 
            onClick={handleNext}
            className="mt-6 w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
          >
            Continue <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}