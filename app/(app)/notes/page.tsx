"use client";

import { useState } from "react";
import { BookOpen, Printer, Sparkles } from "lucide-react";
import EditableStudyNotes from "@/components/notes/EditableStudyNotes";
import ReviewerPdfMaker from "@/components/reviewer/ReviewerPdfMaker";

export default function NotesPage() {
  const [mode, setMode] = useState<"notes" | "reviewer">("notes");

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-10">
    <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50 to-violet-100 p-6 shadow-lg shadow-indigo-950/5 dark:border-indigo-900/60 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 sm:p-8">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300"><Sparkles className="h-4 w-4" />Your learning library</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">Study notes & reviewer maker</h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">Generate editable study notes for on-screen reviewing, or prepare a full two-column Word and PDF reviewer that downloads only when you choose.</p>
    </section>

    <div role="tablist" aria-label="Study notes tools" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      <button type="button" role="tab" aria-selected={mode === "notes"} onClick={() => setMode("notes")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${mode === "notes" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><BookOpen className="h-4 w-4" />Editable notes</button>
      <button type="button" role="tab" aria-selected={mode === "reviewer"} onClick={() => setMode("reviewer")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${mode === "reviewer" ? "bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Printer className="h-4 w-4" />Reviewer maker</button>
    </div>

    {mode === "notes" ? <EditableStudyNotes /> : <ReviewerPdfMaker />}
  </div>;
}
