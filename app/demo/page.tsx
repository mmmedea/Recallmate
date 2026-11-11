import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileText, MessageCircle, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";

const sampleNotes = [
  "Photosynthesis converts light energy into chemical energy stored as glucose.",
  "Chlorophyll absorbs light most strongly in the blue-violet and red regions.",
  "The light-dependent reactions produce ATP and NADPH inside the thylakoid membrane.",
  "The Calvin cycle uses carbon dioxide, ATP, and NADPH to build sugar molecules.",
];

const sampleQuestions = [
  {
    difficulty: "Easy",
    question: "Which pigment is primarily responsible for absorbing light during photosynthesis?",
    answer: "Chlorophyll",
  },
  {
    difficulty: "Medium",
    question: "Why do the light-dependent reactions affect the Calvin cycle?",
    answer: "They provide ATP and NADPH, which the Calvin cycle needs to build sugars.",
  },
  {
    difficulty: "Hard",
    question: "A plant kept in darkness has enough CO₂ and water but produces little glucose. Which process is most directly limited?",
    answer: "The light-dependent reactions, because ATP and NADPH production drops without light.",
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:py-14">
        <section className="overflow-hidden rounded-[2rem] border border-indigo-200 bg-white p-6 shadow-xl shadow-indigo-500/10 dark:border-indigo-500/20 dark:bg-slate-900 sm:p-8">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              Safe sample demo
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
              See RecallMate without uploading anything.
            </h1>
            <p className="mt-4 text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              This demo uses pre-generated sample study material. It does not call the AI generation pipeline, spend credits, or process anonymous uploads.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700"
              >
                Upload your own material
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              <h2 className="text-xl font-black">Sample Notes</h2>
            </div>
            <ul className="space-y-3">
              {sampleNotes.map((note) => (
                <li key={note} className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {note}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <h2 className="text-xl font-black">Sample Quiz</h2>
            </div>
            <div className="space-y-3">
              {sampleQuestions.map((item) => (
                <article key={item.question} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                      {item.difficulty}
                    </span>
                    <span className="text-xs font-bold text-slate-400">Pre-generated</span>
                  </div>
                  <p className="font-bold text-slate-950 dark:text-white">{item.question}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Answer: <span className="font-semibold">{item.answer}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-2">
              <FileText className="h-5 w-5 text-pink-500" />
              <h2 className="text-xl font-black">Sample Reviewer</h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-3 rounded bg-indigo-600 px-3 py-2 text-sm font-black text-white">
                PHOTOSYNTHESIS
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-2">
                  <p className="font-black">Light reactions</p>
                  <p className="text-slate-600 dark:text-slate-300">Location: thylakoid membrane</p>
                  <p className="text-slate-600 dark:text-slate-300">Outputs: ATP, NADPH, O₂</p>
                </div>
                <div className="space-y-2">
                  <p className="font-black">Calvin cycle</p>
                  <p className="text-slate-600 dark:text-slate-300">Location: stroma</p>
                  <p className="text-slate-600 dark:text-slate-300">Uses: CO₂, ATP, NADPH</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                NOTE: Light reactions supply the energy carriers that make sugar production possible.
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
              <h2 className="text-xl font-black">Sample Medea Help</h2>
            </div>
            <div className="space-y-3">
              <div className="ml-auto max-w-[85%] rounded-2xl bg-indigo-600 p-4 text-sm font-semibold text-white">
                Why is darkness a problem if the plant still has CO₂?
              </div>
              <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                CO₂ is only one input. Without light, the light reactions slow down, so the plant cannot make enough ATP and NADPH. The Calvin cycle then lacks the energy carriers it needs to build glucose.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
