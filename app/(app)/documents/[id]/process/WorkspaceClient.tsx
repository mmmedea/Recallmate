"use client";

import { useEffect, useState, useCallback } from "react";
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
  Loader2,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { getDocumentLifecycle } from "@/app/actions/document-actions";

export default function WorkspaceClient({ initialSummary }: { initialSummary: DocumentLifecycleSummary }) {
  const [summary, setSummary] = useState<DocumentLifecycleSummary>(initialSummary);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const { document, notes, quiz } = summary;
  const extStatus = summary.extraction.status;

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

  return (
    <div className="mx-auto max-w-4xl py-12 px-4 transition-colors duration-200">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Processing Workspace</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Tracking the lifecycle of <span className="font-semibold text-slate-800 dark:text-slate-200">{document.filename}</span>
        </p>
      </div>

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
              <p className="mt-1">{summary.extraction.errorMessage || "The system could not extract text from this document."}</p>
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
              description={extractionFailed ? document.extraction.error || 'Failed' : undefined}
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
            {isRefreshing && <Loader2 className="h-4 w-4 motion-safe:animate-spin text-slate-400" aria-label="Refreshing..." />}
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
    Icon = Loader2;
    color = 'text-indigo-500 motion-safe:animate-spin';
    textClass = 'text-indigo-700 dark:text-indigo-400 font-medium';
  } else if (status === 'failed') {
    Icon = AlertCircle;
    color = 'text-red-500';
    textClass = 'text-red-700 dark:text-red-400';
  }

  return (
    <li className="flex items-start">
      <div className="relative mt-0.5">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="ml-3">
        <p className={`text-sm ${textClass}`}>{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
    </li>
  );
}
