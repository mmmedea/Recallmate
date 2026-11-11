"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  BrainCircuit, 
  HelpCircle,
  FileText,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { getDocumentLifecycle } from "@/app/actions/document-actions";
import { DiamondLoader } from "@/components/DiamondLoader";

export default function WorkspaceClient({ initialSummary }: { initialSummary: DocumentLifecycleSummary }) {
  const [summary, setSummary] = useState<DocumentLifecycleSummary>(initialSummary);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startedDocument = useRef<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const revalidate = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getDocumentLifecycle(summary.document.id);
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [summary.document.id]);

  useEffect(() => {
    // 1. Subscribe to changes for this document
    const docChannel = supabase
      .channel('document-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${summary.document.id}` },
        () => revalidate()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Fetch authoritative state on initial connect and any subsequent reconnects
          revalidate();
        }
      });

    // 2. Subscribe to ai_jobs changes for this document
    const jobsChannel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_jobs', filter: `document_id=eq.${summary.document.id}` },
        () => revalidate()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          revalidate();
        }
      });

    return () => {
      supabase.removeChannel(docChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [supabase, summary.document.id, revalidate]);

  useEffect(() => {
    if (startedDocument.current === summary.document.id) return;
    startedDocument.current = summary.document.id;
    // Start this user's queued document immediately. The scheduled worker remains
    // a recovery path for abandoned tabs and transient failures.
    void (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch('/api/jobs/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: summary.document.id }),
        });
        const result = await response.json() as { hasMore?: boolean };
        await revalidate();
        if (!response.ok || !result.hasMore) break;
      }
    })().catch(() => undefined);
  }, [summary.document.id, revalidate]);

  const { document, extraction, notes, quiz } = summary;
  const extStatus = extraction.status;

  const extractionFailed = extStatus === 'failed' || extStatus === 'cancelled';
  const extractionCompleted = extStatus === 'completed';
  const notesCompleted = notes.status === 'ready';
  const notesFailed = notes.status === 'failed' || notes.status === 'cancelled';
  const quizCompleted = quiz.status === 'ready';
  const quizFailed = quiz.status === 'failed' || quiz.status === 'cancelled';
  
  const hasInconsistency = notes.status === 'inconsistent' || quiz.status === 'inconsistent';

  const everythingReady = extractionCompleted && 
    (notes.status !== 'not_requested' ? notesCompleted : true) && 
    (quiz.status !== 'not_requested' ? quizCompleted : true) &&
    !hasInconsistency;
  const progress = getLifecycleProgress(summary);
  const improvements = getProgressImprovements(summary);

  return (
    <div className="mx-auto max-w-4xl py-12 px-4 transition-colors duration-200">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Processing Workspace</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Tracking the lifecycle of <span className="font-semibold text-slate-800 dark:text-slate-200">{document.filename}</span>
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Real progress</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{progress.percent}% complete</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{progress.current}</p>
          </div>
          <button
            onClick={revalidate}
            disabled={isRefreshing}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isRefreshing ? <><DiamondLoader variant="inline" label="Refreshing document status" />Refreshing</> : <><RefreshCw className="mr-2 h-4 w-4" />Refresh</>}
          </button>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">What to improve next</h3>
          <ul className="mt-2 space-y-2">
            {improvements.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Live region for accessibility announcements */}
      <div aria-live="polite" className="sr-only">
        {extractionCompleted ? "Text extraction completed." : (extStatus === 'processing' ? "Extracting text..." : (extractionFailed ? "Text extraction failed." : ""))}
        {notesCompleted && "Study notes are ready."}
        {quizCompleted && "Flashcard quiz is ready."}
        {everythingReady && "All study materials are ready."}
      </div>

      {hasInconsistency && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <div className="flex items-start">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div className="ml-3 text-sm text-amber-600 dark:text-amber-400">
              <p className="font-semibold">Something needs attention</p>
              <p className="mt-1">One of the AI jobs reported success, but the resulting study materials were not found. This might be a temporary delay.</p>
            </div>
          </div>
        </div>
      )}

      {extractionFailed && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="flex items-start">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="ml-3 text-sm text-red-600 dark:text-red-400">
              <p className="font-semibold">Extraction Failed</p>
              <p className="mt-1">{extraction.errorMessage || "The system could not extract text from this document."}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Dimension 1: Document Lifecycle */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
              <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Document</h2>
          </div>
          
          <ul className="space-y-4">
            <TimelineItem 
              label="Uploaded to Storage" 
              status="completed" 
            />
            <TimelineItem 
              label="Text Extraction" 
              status={extractionFailed ? 'failed' : (extractionCompleted ? 'completed' : 'processing')} 
              description={extractionFailed ? extraction.errorMessage || 'Failed' : undefined}
            />
          </ul>
        </div>

        {/* Dimension 2: Study Materials */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <BrainCircuit className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Study Materials</h2>
            </div>
            {isRefreshing && <DiamondLoader variant="inline" label="Refreshing study materials" />}
          </div>

          <ul className="space-y-4">
            {/* Notes */}
            {notes.status !== 'not_requested' ? (
               <TimelineItem 
                 label="Study Notes" 
                 status={notesFailed ? 'failed' : (notesCompleted ? 'completed' : 'processing')} 
               />
            ) : (
               <TimelineItem 
                 label="Study Notes" 
                 status={extractionFailed ? 'failed' : (extractionCompleted ? 'waiting' : 'waiting')} 
                 description={extractionCompleted ? 'Auto-generation off or not started' : 'Waiting for extraction'}
               />
            )}

            {/* Quiz */}
            {quiz.status !== 'not_requested' ? (
               <TimelineItem 
                 label="Flashcard Quiz" 
                 status={quizFailed ? 'failed' : (quizCompleted ? 'completed' : 'processing')} 
               />
            ) : (
               <TimelineItem 
                 label="Flashcard Quiz" 
                 status={extractionFailed ? 'failed' : (extractionCompleted ? 'waiting' : 'waiting')} 
                 description={extractionCompleted ? 'Auto-generation off or not started' : 'Waiting for extraction'}
               />
            )}
          </ul>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="mt-12 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-8">
        <button 
          onClick={revalidate}
          disabled={isRefreshing}
          className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors flex items-center"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh status manually'}
        </button>

        {everythingReady && !extractionFailed && (
          <Link
            href={`/documents/${document.id}`}
            className="flex items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Go to Study Hub
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ label, status, description }: { label: string, status: 'completed' | 'processing' | 'failed' | 'waiting', description?: string }) {
  let Icon = Circle;
  let color = 'text-slate-300 dark:text-slate-700';
  let textClass = 'text-slate-500 dark:text-slate-400';

  if (status === 'completed') {
    Icon = CheckCircle2;
    color = 'text-emerald-500';
    textClass = 'text-slate-900 dark:text-white';
  } else if (status === 'processing') {
    textClass = 'text-indigo-700 dark:text-indigo-400 font-medium';
  } else if (status === 'failed') {
    Icon = AlertCircle;
    color = 'text-red-500';
    textClass = 'text-red-700 dark:text-red-400';
  }

  return (
    <li className="flex items-start">
      <div className="relative mt-0.5">
        {status === 'processing' ? (
          <DiamondLoader variant="inline" label={`Processing ${label}`} />
        ) : (
          <Icon className={`h-5 w-5 ${color}`} />
        )}
      </div>
      <div className="ml-3">
        <p className={`text-sm ${textClass}`}>{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
    </li>
  );
}

function getLifecycleProgress(summary: DocumentLifecycleSummary) {
  const extractionFailed = summary.extraction.status === 'failed' || summary.extraction.status === 'cancelled';
  const extractionCompleted = summary.extraction.status === 'completed';
  const notesCompleted = summary.notes.status === 'ready';
  const quizCompleted = summary.quiz.status === 'ready';
  const notesFailed = summary.notes.status === 'failed' || summary.notes.status === 'cancelled' || summary.notes.status === 'inconsistent';
  const quizFailed = summary.quiz.status === 'failed' || summary.quiz.status === 'cancelled' || summary.quiz.status === 'inconsistent';

  const stages = [
    true,
    extractionCompleted,
    notesCompleted,
    quizCompleted,
  ];
  const percent = Math.max(25, Math.round((stages.filter(Boolean).length / stages.length) * 100));

  let current = 'Upload is saved. Waiting for extraction to start.';
  if (extractionFailed) current = summary.extraction.errorMessage || 'Text extraction failed.';
  else if (!extractionCompleted) current = 'Extracting readable lesson text from the uploaded file.';
  else if (notesFailed || quizFailed) current = 'One generated study material needs retry from the Study Hub.';
  else if (!notesCompleted) current = 'Generating editable notes from the extracted lesson text.';
  else if (!quizCompleted) current = 'Generating quiz questions from the extracted lesson text.';
  else current = 'Notes and quiz are ready.';

  return { percent, current };
}

function getProgressImprovements(summary: DocumentLifecycleSummary) {
  const items: string[] = [];
  const extractionFailed = summary.extraction.status === 'failed' || summary.extraction.status === 'cancelled';
  const extractionCompleted = summary.extraction.status === 'completed';

  if (extractionFailed) {
    items.push('Retry extraction. If it fails again, upload a clearer PDF/PPTX with selectable text.');
    items.push('For scanned files, use a higher-resolution PDF so Medea can read the pages.');
    return items;
  }

  if (!extractionCompleted) {
    items.push('Keep this page open or refresh status. The worker is reading the uploaded file now.');
    items.push('If progress stays here, retry from this page or upload a smaller PDF/PPTX.');
    return items;
  }

  if (summary.notes.status === 'failed' || summary.notes.status === 'inconsistent') {
    items.push('Open the Study Hub and retry Notes so the editable study notes are rebuilt.');
  } else if (summary.notes.status !== 'ready') {
    items.push('Open the Study Hub to generate editable notes if they do not start automatically.');
  }

  if (summary.quiz.status === 'failed' || summary.quiz.status === 'inconsistent') {
    items.push('Open the Study Hub and retry Quiz so the question set is rebuilt.');
  } else if (summary.quiz.status !== 'ready') {
    items.push('Open the Study Hub to generate quiz questions if they do not start automatically.');
  }

  if (!items.length) items.push('Open the Study Hub and continue reviewing.');
  return items;
}
