"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, FileText, Cpu, CheckCircle } from "lucide-react";

const STEPS = [
  "Extracting text from uploaded file...",
  "Analyzing core facts and key sections...",
  "Drafting multiple-choice recall questions...",
  "Extracting page numbers and source quotes...",
];

export default function GenerationLoader() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center max-w-md mx-auto">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center animate-pulse">
          <Cpu className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
        </div>
        <Sparkles className="w-6 h-6 text-amber-400 absolute -top-2 -right-2 animate-bounce" />
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Generating Study Notes
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Hold tight! We're crafting your interactive recall quiz directly from your file.
        </p>
      </div>

      <div className="w-full space-y-3 pt-4">
        {STEPS.map((step, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-xs font-medium transition-all ${
              idx <= currentStep
                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-300"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-400"
            }`}
          >
            {idx < currentStep ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 shrink-0" />
            )}
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}