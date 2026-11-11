import Link from "next/link";
import { AlertCircle, ArrowRight, BrainCircuit, CheckCircle2, FileText, HelpCircle } from "lucide-react";
import type { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import { DiamondLoader } from "@/components/DiamondLoader";
import { DeleteDocumentButton } from "@/components/dashboard/DeleteDocumentButton";

export function DashboardDocumentCard({ doc }: { doc: DocumentLifecycleSummary }) {
  const { document, extraction, notes, quiz } = doc;
  const isFailed = extraction.status === "failed" || extraction.status === "cancelled";
  const isReady = extraction.status === "completed";
  const isProcessing = ["uploaded", "queued", "processing", "analyzing", "generating"].includes(extraction.status);
  const needsAttention = notes?.status === "inconsistent" || quiz?.status === "inconsistent" || notes?.status === "failed" || quiz?.status === "failed";
  const notesReady = notes?.status === "ready";
  const quizReady = quiz?.status === "ready";
  const targetHref = `/documents/${document.id}${isReady ? "" : "/process"}`;

  return (
    <article className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/10 dark:border-white/10 dark:bg-slate-950/70 dark:hover:border-violet-400/40">
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge isReady={isReady} isProcessing={isProcessing} isFailed={isFailed} needsAttention={needsAttention} />
            <DeleteDocumentButton documentId={document.id} filename={document.filename} />
          </div>
        </div>

        <h3 className="mt-5 line-clamp-2 text-lg font-black tracking-tight text-slate-950 dark:text-white" title={document.filename}>
          {document.filename}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {new Date(document.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>

        {isFailed && extraction.errorMessage && (
          <p className="mt-3 line-clamp-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {extraction.errorMessage}
          </p>
        )}
      </div>

      <div className="relative mt-6 border-t border-slate-200/70 pt-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            <span className={notesReady ? "flex items-center text-violet-700 dark:text-violet-300" : "flex items-center text-slate-400 dark:text-slate-600"}>
              <BrainCircuit className="mr-1.5 h-3.5 w-3.5" />
              Notes
            </span>
            <span className={quizReady ? "flex items-center text-emerald-700 dark:text-emerald-300" : "flex items-center text-slate-400 dark:text-slate-600"}>
              <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
              Quiz
            </span>
          </div>
          <Link
            href={targetHref}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100"
          >
            {isReady ? "Continue" : isFailed ? "Fix" : "Progress"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({
  isReady,
  isProcessing,
  isFailed,
  needsAttention,
}: {
  isReady: boolean;
  isProcessing: boolean;
  isFailed: boolean;
  needsAttention: boolean;
}) {
  if (isFailed) {
    return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-500/10 dark:text-red-300"><AlertCircle className="mr-1 h-3 w-3" />Failed</span>;
  }
  if (needsAttention) {
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300"><AlertCircle className="mr-1 h-3 w-3" />Needs fix</span>;
  }
  if (isProcessing) {
    return (
      <div role="status" aria-label="Processing document" className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-500/10 dark:text-blue-300">
        <DiamondLoader variant="inline" decorative label="Processing document" />
        <span>Processing</span>
      </div>
    );
  }
  if (isReady) {
    return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Ready</span>;
  }
  return null;
}
