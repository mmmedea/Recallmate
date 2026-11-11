"use client";

import Link from "next/link";
import { Upload, Sparkles, Brain, Heart, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navbar />
      <section className="relative isolate flex min-h-[calc(100vh-78px)] flex-col items-center overflow-hidden px-4 pb-20 pt-24 text-center sm:pt-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-20 -z-10 mx-auto h-[430px] max-w-5xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,60,190,0.19),rgba(2,6,23,0)_68%)] blur-2xl" />
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-800/70 bg-indigo-950/45 px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-indigo-300 shadow-sm">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          AI-powered exam practice + active recall
        </div>

        <div className="w-full max-w-5xl space-y-7">
          <h1 className="mx-auto max-w-4xl text-4xl font-black leading-[1.06] tracking-[-0.045em] text-white sm:text-6xl md:text-[4.65rem]">
            Turn any file into an<br className="hidden md:block" /> exam questionnaire your<br className="hidden md:block" /> brain will{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">remember.</span>
          </h1>
          <p className="mx-auto max-w-3xl text-base font-medium leading-relaxed text-slate-300 sm:text-lg">
            Upload documents, slides, or images. RecallMate turns your material into clear study notes, source-grounded practice questions, and interactive quizzes to help you master what matters.
          </p>
        </div>

        <div className="mt-12">
          <Link
            href="/upload"
            className="inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-lg font-extrabold text-white shadow-xl shadow-indigo-950/50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/25 active:translate-y-0"
          >
            <Upload className="h-5 w-5" />
            Upload a File
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-24 grid w-full max-w-6xl grid-cols-1 gap-5 px-1 text-left sm:grid-cols-3">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/10 backdrop-blur">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300"><Sparkles className="h-5 w-5" /></div>
            <h2 className="mb-2 text-lg font-extrabold text-white">AI study notes</h2>
            <p className="text-sm leading-relaxed text-slate-400">Turn lengthy documents and lecture slides into organized summaries and key points.</p>
          </article>
          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/10 backdrop-blur">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300"><Brain className="h-5 w-5" /></div>
            <h2 className="mb-2 text-lg font-extrabold text-white">Source-grounded quizzes</h2>
            <p className="text-sm leading-relaxed text-slate-400">Practice with questions based on your own materials and review at your pace.</p>
          </article>
          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/10 backdrop-blur">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300"><Heart className="h-5 w-5" /></div>
            <h2 className="mb-2 text-lg font-extrabold text-white">Active recall</h2>
            <p className="text-sm leading-relaxed text-slate-400">Build a consistent study habit with focused practice and progress-friendly sessions.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
