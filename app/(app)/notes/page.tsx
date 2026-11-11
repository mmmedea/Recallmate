"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, BrainCircuit, FilePlus2, Printer, Sparkles } from "lucide-react";
import ProgressiveNote from "@/components/ProgressiveNote";
import MathRenderer from "@/components/MathRenderer";

export default function NotesPage() {
  const [content, setContent] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("recallmate-content");
    if (raw) {
      try {
        setContent(JSON.parse(raw));
      } catch {
        sessionStorage.removeItem("recallmate-content");
      }
    }
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!content) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center px-4 py-10">
        <section className="w-full overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50 to-violet-50 p-8 text-center shadow-xl shadow-indigo-950/5 dark:border-indigo-900/60 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 sm:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25"><BookOpen className="h-8 w-8" /></span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Your learning library</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Study notes</h1>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600 dark:text-slate-300">No generated notes are open yet. Upload a document, slide deck, image, or text file and let Medea create organized notes you can review here.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => router.push("/upload")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-700"><FilePlus2 className="h-4 w-4" />Upload study material</button>
            <button onClick={() => router.push("/upload?mode=reviewer")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-bold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-slate-800 dark:text-indigo-200"><Printer className="h-4 w-4" />Create reviewer PDF</button>
            <button onClick={() => router.push("/topics")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Sparkles className="h-4 w-4" />Explore study tools</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-10 px-4 space-y-8 pb-32 transition-colors duration-200">
      {/* Top Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => router.push("/upload")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Upload
        </button>
        <div className="flex flex-wrap justify-end gap-2"><button onClick={() => router.push("/upload?mode=reviewer")} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Printer className="h-4 w-4" />Create reviewer PDF</button><button
            onClick={() => {
              sessionStorage.setItem("recallmate-reconfigure", "true");
              router.push("/upload");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98]"
          >
            <BrainCircuit className="w-4 h-4" /> Switch to Quiz Mode
          </button></div>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          {content.fileName}
        </h1>
        <MathRenderer
          content={content.summary}
          className="text-base text-slate-600 dark:text-slate-400 leading-relaxed"
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-6 h-6" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              AI Study Notes & Concepts
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Progressive Accordions
          </span>
        </div>

        <div className="space-y-4">
          {content.notes?.map((note: string, idx: number) => {
            // Extract potential title or use default heading
            const parts = note.split(":");
            const title = parts.length > 1 ? parts[0] : `Concept Note ${idx + 1}`;
            const body = parts.length > 1 ? parts.slice(1).join(":").trim() : note;

            return (
              <ProgressiveNote
                key={idx}
                index={idx}
                title={title}
                content={body}
                difficulty={idx % 4 === 3 ? "hard" : "easy"}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}
