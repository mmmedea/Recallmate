"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { downloadReviewerPdf, readReviewerFile } from "@/lib/reviewer/browser-reviewer";

export default function ReviewerPdfMaker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const createReviewer = async (file: File) => {
    setBusy(true); setError(""); setStatus("Reading every lesson section and picture…");
    try {
      const sections = await readReviewerFile(file);
      setStatus(`Building a two-column PDF from ${sections.length} retained section${sections.length === 1 ? "" : "s"}…`);
      await downloadReviewerPdf(file, sections);
      setStatus("Reviewer PDF downloaded. Course, learning-outcome, and thank-you sections were excluded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reviewer could not be created.");
      setStatus("");
    } finally { setBusy(false); }
  };

  return <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900">
    <div className="grid md:grid-cols-[0.9fr_1.1fr]">
      <div className="bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Reviewer maker</p>
        <h2 className="mt-2 text-3xl font-black">Detailed, printable, two-column PDF</h2>
        <p className="mt-4 text-sm leading-6 text-slate-300">RecallMate keeps the lesson’s full readable detail and embedded pictures. It removes only course-information, learning-outcome/objective, and thank-you sections.</p>
        <ul className="mt-6 space-y-3 text-sm text-slate-200">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Black-and-white academic layout</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Two readable columns on A4 pages</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />PDF, PPT, and PPTX input</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />PPTX and PDF processing stays in this browser</li>
        </ul>
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <input ref={inputRef} type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void createReviewer(file); event.target.value = ""; }} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="group min-h-56 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:-translate-y-1 hover:border-slate-950 hover:bg-white disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-white dark:hover:bg-slate-950">
          {busy ? <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-500" /> : <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950"><FileUp className="h-8 w-8" /></span>}
          <span className="mt-5 block text-xl font-black text-slate-950 dark:text-white">{busy ? "Creating your reviewer…" : "Choose lesson file"}</span>
          <span className="mt-2 block text-sm text-slate-500">PDF, PPT, or PPTX • download as PDF</span>
        </button>
        {status && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"><Download className="mt-0.5 h-4 w-4 shrink-0" />{status}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">For old .ppt files, text is preserved through secure extraction. Save as .pptx first when you need every embedded picture preserved exactly.</p>
      </div>
    </div>
  </section>;
}
