"use client";

import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Upload,
} from "lucide-react";

import { MedeaLauncher } from "@/components/medea/MedeaLauncher";

export default function TopicsPage() {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in duration-500">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Learn your way
          </p>

          <h1 className="text-3xl font-bold dark:text-white">
            Topics &amp; flashcards
          </h1>

          <p className="mt-2 text-slate-500">
            Create cards yourself or let Medea turn
            uploaded material into a quiz.
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
        >
          <Upload className="h-4 w-4" />
          Upload material
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Link
          href="/upload?mode=flashcards"
          className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 transition hover:-translate-y-1 hover:shadow-lg dark:border-indigo-900 dark:bg-indigo-950/30"
        >
          <BookOpen className="mb-4 h-8 w-8 text-indigo-600" />

          <h2 className="font-bold dark:text-white">
            Create flashcards
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Write the prompt and answer you want to
            remember.
          </p>
        </Link>

        <Link
          href="/upload"
          className="rounded-2xl border border-violet-200 bg-violet-50 p-6 transition hover:-translate-y-1 hover:shadow-lg dark:border-violet-900 dark:bg-violet-950/30"
        >
          <Upload className="mb-4 h-8 w-8 text-violet-600" />

          <h2 className="font-bold dark:text-white">
            Quiz
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Upload once to generate notes and practice
            questions.
          </p>
        </Link>

        <MedeaLauncher
          source="topics"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-left transition hover:-translate-y-1 hover:shadow-lg dark:border-rose-900 dark:bg-rose-950/30"
          aria-label="Ask Medea"
        >
          <Sparkles className="mb-4 h-8 w-8 text-rose-600" />

          <h2 className="font-bold dark:text-white">
            Ask Medea
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Open Medea AI here and ask any simple or
            complex question.
          </p>
        </MedeaLauncher>
      </div>
    </div>
  );
}