"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import { 
  FileText, 
  BrainCircuit, 
  HelpCircle,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  RefreshCw,
  Loader2,
  BookOpen,
  Printer
} from "lucide-react";
import Link from "next/link";
import { getDocumentLifecycle, retryDocumentExtraction, retryStudyGeneration } from "@/app/actions/document-actions";
import { ReviewerMakerDialog } from "@/components/reviewer/ReviewerMakerDialog";
import { useAppStore } from "@/lib/store";

export default function StudyHubClient({ initialSummary }: { initialSummary: DocumentLifecycleSummary }) {
  const [summary, setSummary] = useState<DocumentLifecycleSummary>(initialSummary);
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showReviewerDialog, setShowReviewerDialog] = useState(false);

  const revalidate = useCallback(async () => {
    const res = await getDocumentLifecycle(summary.document.id);
    if (res.success && res.data) {
      setSummary(res.data);
    }
  }, [summary.document.id]);

  useEffect(() => {
    const docChannel = supabase
      .channel('hub-document-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${summary.document.id}` },
        () => revalidate()
      )
      .subscribe();

    const jobsChannel = supabase
      .channel('hub-jobs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_jobs', filter: `document_id=eq.${summary.document.id}` },
        () => revalidate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(docChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [supabase, summary.document.id, revalidate]);

  const handleRetryExtraction = () => {
    setActiveAction('extraction');
    startTransition(async () => {
      await retryDocumentExtraction(summary.document.id);
      await revalidate();
      setActiveAction(null);
    });
  };

  const handleStudyAction = (operation: 'generate_notes' | 'generate_quiz') => {
    setActiveAction(operation);
    startTransition(async () => {
      await retryStudyGeneration(summary.document.id, operation);
      await revalidate();
      setActiveAction(null);
    });
  };

  const { document, extraction, notes, quiz } = summary;
  const extractionFailed = extraction.status === 'failed' || extraction.status === 'cancelled';
  
  if (extractionFailed) {
    return (
      <div className="mx-auto max-w-4xl py-12 px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/10">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-900 dark:text-red-400">Document processing failed</h2>
          <p className="mt-2 text-red-700 dark:text-red-300 max-w-lg mx-auto">
            {extraction.errorMessage || "We couldn't extract the text from your document. This is required before study materials can be generated."}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleRetryExtraction}
              disabled={isPending && activeAction === 'extraction'}
              className="inline-flex items-center rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {isPending && activeAction === 'extraction' ? (
                <><Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> Retrying...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Retry Extraction</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Accessibility Announcements
  return (
    <div className="mx-auto max-w-5xl py-12 px-4">
      {/* Live region for accessibility announcements */}
      <div aria-live="polite" className="sr-only">
        {notes.status === 'ready' && "Study notes are ready."}
        {notes.status === 'failed' && "Notes generation failed."}
        {quiz.status === 'ready' && "Flashcard quiz is ready."}
        {quiz.status === 'failed' && "Quiz generation failed."}
        {isPending && "Requesting generation, please wait."}
      </div>

      <div className="mb-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Study Hub</h1>
          <div className="mt-2 flex items-center text-slate-600 dark:text-slate-400">
            <FileText className="mr-2 h-4 w-4" />
            <span className="font-medium">{document.filename}</span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="sr-only">Study Materials</h2>
        <div className="flex flex-col space-y-4">
          
          {/* NOTES CARD */}
          <StudyMaterialCard
            title="Notes"
            description="Review the key ideas"
            icon={<BrainCircuit className="h-6 w-6 text-indigo-500" />}
            status={notes.status}
            errorMessage={notes.errorMessage}
            onAction={() => handleStudyAction('generate_notes')}
            isPending={isPending && activeAction === 'generate_notes'}
            readyHref={notes.outputId ? `/notes/${notes.outputId}` : undefined}
            actionLabels={{ ready: 'Open Notes', generate: 'Generate Notes' }}
          />

          {/* QUIZ CARD */}
          <StudyMaterialCard
            title="Quiz"
            description="Test your recall"
            icon={<HelpCircle className="h-6 w-6 text-emerald-500" />}
            status={quiz.status}
            errorMessage={quiz.errorMessage}
            onAction={() => handleStudyAction('generate_quiz')}
            isPending={isPending && activeAction === 'generate_quiz'}
            readyHref={quiz.status === 'ready' ? `/quiz/${document.id}` : undefined}
            actionLabels={{ ready: 'Start Quiz', generate: 'Generate Quiz' }}
          />

          {/* REVIEWER MAKER CARD */}
          <StudyMaterialCard
            title="Reviewer Maker"
            description="Turn this material into a printable, exam-ready reviewer"
            icon={<Printer className="h-6 w-6 text-orange-500" />}
            status={extractionFailed ? 'failed' : 'ready'} // Ready as long as extraction is complete
            errorMessage={extractionFailed ? "Cannot generate reviewer without document text" : undefined}
            onAction={() => setShowReviewerDialog(true)}
            isPending={false}
            actionLabels={{ ready: 'Create Reviewer', generate: 'Create Reviewer' }}
          />

          {/* CHAT CARD */}
          <ChatMaterialCard
            documentId={document.id}
            status={summary.chat.status}
            lastDiscussedAt={summary.chat.lastDiscussedAt}
          />
        </div>
      </div>
    </div>
  );
}

function StudyMaterialCard({
  title,
  description,
  icon,
  status,
  errorMessage,
  onAction,
  isPending,
  readyHref,
  actionLabels
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: string;
  errorMessage: string | null;
  onAction: () => void;
  isPending: boolean;
  readyHref?: string;
  actionLabels: { ready: string; generate: string };
}) {
  const isFailed = status === 'failed' || status === 'inconsistent';
  const isProcessing = status === 'queued' || status === 'processing';
  const isReady = status === 'ready';
  const isNotRequested = status === 'not_requested';

  return (
    <div className={`flex flex-col sm:flex-row rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900 ${isFailed ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-slate-800'}`}>
      
      <div className="flex items-start sm:items-center space-x-4 flex-grow mb-4 sm:mb-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          <div className="mt-1 flex items-center">
            <span 
              className={`text-sm font-medium ${isReady ? 'text-emerald-600 dark:text-emerald-400' : isProcessing ? 'text-indigo-600 dark:text-indigo-400' : isFailed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}
              aria-live="polite"
            >
              {isReady && 'Ready'}
              {isProcessing && 'Generating...'}
              {isFailed && (status === 'inconsistent' ? 'Something needs attention' : 'Generation failed')}
              {isNotRequested && 'Not generated'}
            </span>
          </div>
          {isFailed && errorMessage && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 max-w-sm">{errorMessage}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center sm:ml-6 sm:w-48 shrink-0">
        {isReady && readyHref && (
          <Link
            href={readyHref}
            className="flex w-full items-center justify-center rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-colors"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            {actionLabels.ready}
          </Link>
        )}

        {isFailed && (
          <button
            onClick={onAction}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> Retrying...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Retry {title}</>
            )}
          </button>
        )}

        {isNotRequested && (
          <button
            onClick={onAction}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> Starting...</>
            ) : (
              <><PlayCircle className="mr-2 h-4 w-4" /> {actionLabels.generate}</>
            )}
          </button>
        )}

        {isProcessing && (
          <div className="flex w-full items-center justify-center rounded-lg bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:bg-slate-800/50 transition-colors">
            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> Generating...
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMaterialCard({
  documentId,
  status,
  lastDiscussedAt
}: {
  documentId: string;
  status: 'ready' | 'not_requested';
  lastDiscussedAt: string | null;
}) {
  const isReady = status === 'ready';
  const openMedea = useAppStore(state => state.setChatDrawerOpen);

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  return (
    <div className={`flex flex-col sm:flex-row rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${!isReady ? 'opacity-75 grayscale' : ''}`}>
      <div className="flex items-start sm:items-center space-x-4 flex-grow mb-4 sm:mb-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
          <MessageSquare className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Medea</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ask questions about this document</p>
          <div className="mt-1 flex items-center">
            {lastDiscussedAt ? (
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Last discussed {formatTimeAgo(lastDiscussedAt)}
              </span>
            ) : (
              <span className={`text-sm font-medium ${isReady ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                {isReady ? 'Ready' : 'Not available yet'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center sm:ml-6 sm:w-48 shrink-0">
        {isReady ? (
          <button
            type="button"
            onClick={() => openMedea(true)}
            className="flex w-full items-center justify-center rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label={lastDiscussedAt ? "Continue conversation with Medea" : "Ask Medea"}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {lastDiscussedAt ? "Continue" : "Ask Medea"}
          </button>
        ) : (
          <button
            disabled
            className="flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:text-slate-500"
          >
            Not Available
          </button>
        )}
      </div>
    </div>
  );
}
