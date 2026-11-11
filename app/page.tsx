"use client";

import Link from "next/link";
import { Upload, Sparkles, Brain, Heart, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="relative min-h-[85vh] flex flex-col justify-center items-center text-center space-y-12 py-12 transition-colors duration-300 overflow-hidden">
        {/* Soft Background Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[120px] rounded-full pointer-events-none -z-10 motion-safe:animate-pulse" />

        {/* Hero Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/50 backdrop-blur-md shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-700">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold tracking-wide text-indigo-700 dark:text-indigo-300 uppercase">
            Predictive Exam AI + Active Recall
          </span>
        </div>

        {/* Main Heading & Subtitle */}
        <div className="max-w-3xl space-y-6 px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Turn any file into an exam questionnaire your brain will{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
              remember.
            </span>
          </h1>
          <p className="text-base sm:text-lg font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Upload documents, slides, or images. AI predicts realistic exam questions, extracts key facts, and creates interactive quizzes to master.
          </p>
        </div>

        {/* CTA Upload Button */}
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
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
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
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
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Predictive Questionnaires
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Forecasts realistic test questions divided into Easy, Medium, and Hard difficulty levels.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 duration-700 delay-700 fill-mode-both">
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

        {/* Medea AI Teaser */}
        <div className="w-full max-w-3xl mt-16 px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 duration-700 delay-1000 fill-mode-both">
          <div className="p-8 md:p-10 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row items-center gap-8 text-left relative overflow-hidden shadow-sm">
            {/* Background flourish */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -z-10" />
            
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Meet Medea
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                Your personal AI study tutor
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                Stuck on a difficult concept? Ask Medea. She knows exactly what's in your uploaded material and can explain complex topics, summarize chapters, or test your knowledge in real-time.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full md:w-auto shrink-0 z-10">
              <Link
                href="/upload"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all text-center"
              >
                Upload your material
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm transition-all text-center"
              >
                Sign in to ask Medea
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}