"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Printer, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { createReviewerArtifacts, downloadReviewerArtifact, readReviewerFile, REVIEWER_THEMES, type ReviewerArtifacts } from "@/lib/reviewer/browser-reviewer";

export function ReviewerMakerDialog({ documentId, isOpen, onClose }: { documentId: string; isOpen: boolean; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [artifacts, setArtifacts] = useState<ReviewerArtifacts | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);

  const generate = async () => {
    setBusy(true); setError(""); setArtifacts(null);
    try {
      const { data: document, error: documentError } = await supabase.from("documents").select("filename, storage_path").eq("id", documentId).single();
      if (documentError || !document) throw new Error("The original lesson file could not be found.");
      const { data: blob, error: downloadError } = await supabase.storage.from("study_materials").download(document.storage_path);
      if (downloadError || !blob) throw new Error("The original lesson file could not be downloaded.");
      const file = new File([blob], document.filename, { type: blob.type });
      const sections = await readReviewerFile(file);
      setArtifacts(await createReviewerArtifacts(file, sections, REVIEWER_THEMES[themeIndex]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reviewer could not be created.");
    } finally { setBusy(false); }
  };

  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reviewer-dialog-title">
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Reviewer maker</p><h2 id="reviewer-dialog-title" className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Create detailed reviewer files</h2></div><button type="button" onClick={onClose} aria-label="Close reviewer maker" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Your original file is transformed into a black-and-white, true two-column reviewer. Lesson details, compact tables, note callouts, and embedded pictures are preserved; only course-information, learning-outcome/objective, and thank-you sections are removed.</p>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/50"><p className="flex gap-2 font-bold text-slate-900 dark:text-white"><CheckCircle2 className="h-5 w-5 text-emerald-500" />PDF and editable Word formats</p><p className="mt-2 text-slate-500">Generation happens in this browser from your private source file.</p></div>
      <fieldset className="mt-5"><legend className="text-sm font-black text-slate-950 dark:text-white">Accent color</legend><p className="mt-1 text-xs text-slate-500">All text stays black; this changes only borders, lines, and callout backgrounds.</p><div className="mt-3 flex flex-wrap gap-2">{REVIEWER_THEMES.map((theme, index) => <button key={theme.name} type="button" aria-label={`${theme.name} reviewer accents`} aria-pressed={themeIndex === index} onClick={() => { setThemeIndex(index); setArtifacts(null); }} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black ${themeIndex === index ? "border-slate-950 ring-2 ring-slate-400 dark:border-white" : "border-slate-200 dark:border-slate-700"}`}><span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: `#${theme.accent}` }} />{theme.name}</button>)}</div></fieldset>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      {artifacts && <div role="status" className="mt-4 space-y-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10"><p className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">Reviewer ready. Nothing has downloaded yet.</p><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => downloadReviewerArtifact(artifacts.pdf, `${artifacts.baseName}-reviewer.pdf`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950"><Download className="h-4 w-4" />Download PDF</button><button type="button" onClick={() => downloadReviewerArtifact(artifacts.docx, `${artifacts.baseName}-reviewer.docx`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><FileText className="h-4 w-4" />Download Word</button></div></div>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 dark:text-slate-300">Close</button><button type="button" disabled={busy} onClick={() => void generate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}{busy ? "Preparing files…" : artifacts ? "Recreate reviewer" : "Create reviewer"}</button></div>
    </div>
  </div>;
}
