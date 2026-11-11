"use client";

import Link from "next/link";
import { Upload, Sparkles, Brain, Heart, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative min-h-[85vh] flex flex-col justify-center items-center text-center space-y-12 py-12 transition-colors duration-300">
      {/* Soft Background Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/50 backdrop-blur-md shadow-sm">
        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-bold tracking-wide text-indigo-700 dark:text-indigo-300 uppercase">
          Notes + Active Recall Combined
        </span>
      </div>

      {/* Main Heading & Subtitle */}
      <div className="max-w-3xl space-y-6 px-4">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Turn any file into a study session your brain will{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
            remember.
          </span>
        </h1>
        <p className="text-base sm:text-lg font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Upload a PDF, document, or audio lecture. AI extracts key facts, drafts interactive
          A/B/C/D quizzes with source citations, and keeps you engaged.
        </p>
      </div>

      {/* CTA Upload Button */}
      <div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-extrabold text-lg shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <Upload className="w-5 h-5" />
          <span>Upload a File</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl w-full px-4 pt-8">
        {/* Card 1 */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            AI-generated Notes
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Instant summaries and organized bullet points directly extracted from your source files.
          </p>
        </div>

        {/* Card 2 */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            3-Tier Active Recall
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Interactive multiple-choice questions (A, B, C, D) categorized into Easy, Medium, and Hard.
          </p>
        </div>

        {/* Card 3 */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Hearts System
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Gamified learning stakes that keep you focused while testing your recall precision.
          </p>
        </div>
      </div>
    </div>
  );
}