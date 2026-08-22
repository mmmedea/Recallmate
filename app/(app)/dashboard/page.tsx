import { getRecentDocuments } from "@/app/actions/document-actions";
import Link from "next/link";
import { 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BrainCircuit, 
  HelpCircle,
  FileSearch,
  ArrowRight
} from "lucide-react";
import type { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data: documents, success, error } = await getRecentDocuments();

  if (!success) {
    return (
      <div className="mx-auto max-w-4xl py-12 px-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Failed to load library</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{error || "An unexpected error occurred"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-12 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Your Library</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Manage your study materials and generated content.
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          Upload Material
        </Link>
      </div>

      {(!documents || documents.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 py-24 text-center">
          <FileSearch className="mb-4 h-12 w-12 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No documents yet</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Upload your first lecture, textbook chapter, or clinical guideline to start generating study materials.
          </p>
          <Link
            href="/upload"
            className="mt-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
          >
            Upload your first document
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.document.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentLifecycleSummary }) {
  const { document, notes, quiz } = doc;
  
  // Determine overall card state
  const isFailed = document.extraction.status === 'failed' || document.extraction.status === 'cancelled';
  const isReady = document.extraction.status === 'completed';
  const isProcessing = ['uploaded', 'queued', 'extracting', 'analyzing', 'generating'].includes(document.extraction.status);

  // Inconsistent check: extraction is complete, notes/quiz jobs succeeded but outputs are missing
  const needsAttention = notes.status === 'inconsistent' || quiz.status === 'inconsistent' || notes.status === 'failed' || quiz.status === 'failed';

  const notesReady = notes.status === 'ready';
  const quizReady = quiz.status === 'ready';

  return (
    <Link 
      href={`/documents/${document.id}${isReady ? '' : '/process'}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800"
    >
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
              <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <StatusBadge 
            isReady={isReady} 
            isProcessing={isProcessing} 
            isFailed={isFailed} 
            needsAttention={needsAttention} 
          />
        </div>
        
        <h3 className="mt-4 truncate text-base font-semibold text-slate-900 dark:text-white" title={document.filename}>
          {document.filename}
        </h3>
        
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {new Date(document.createdAt).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </p>

        {isFailed && document.extraction.error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 line-clamp-2">
            {document.extraction.error}
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-4 text-xs font-medium">
            <span className={`flex items-center ${notesReady ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>
              <BrainCircuit className="mr-1.5 h-3.5 w-3.5" />
              Notes
            </span>
            <span className={`flex items-center ${quizReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}>
              <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
              Quiz
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link 
              href={`/documents/${document.id}/review`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md"
            >
              Review Due
            </Link>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ 
  isReady, 
  isProcessing, 
  isFailed, 
  needsAttention 
}: { 
  isReady: boolean, 
  isProcessing: boolean, 
  isFailed: boolean, 
  needsAttention: boolean 
}) {
  if (isFailed) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/10 dark:ring-red-500/20">
        <AlertCircle className="mr-1 h-3 w-3" />
        Failed
      </span>
    );
  }
  
  if (needsAttention) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/10 dark:ring-amber-500/20">
        <AlertCircle className="mr-1 h-3 w-3" />
        Needs Attention
      </span>
    );
  }

  if (isProcessing) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/10 dark:ring-blue-500/20">
        <Clock className="mr-1 h-3 w-3" />
        Processing
      </span>
    );
  }

  if (isReady) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/10 dark:ring-emerald-500/20">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Ready
      </span>
    );
  }

  return null;
}
