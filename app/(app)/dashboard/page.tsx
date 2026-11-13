import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getRecentDocuments } from "@/app/actions/document-actions";
import { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";
import { 
  FileText, BrainCircuit, HelpCircle, ArrowRight, Clock, AlertCircle, 
  CheckCircle2, FileSearch, UploadCloud, Brain, Target, Flame 
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import MedeaWelcomeCard from "@/components/dashboard/MedeaWelcomeCard";
import EconomyDashboard from "@/components/dashboard/EconomyDashboard";

export const metadata = {
  title: "Dashboard | RecallMate",
  description: "View your study materials and generated content.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const name = session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student';
  const { data: documents, success, error } = await getRecentDocuments();

  return (
    <div className="mx-auto max-w-6xl py-8 px-4 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4 duration-500">
            Welcome back, <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">{name}</span>!
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Here's your study overview for today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/upload">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
              <UploadCloud className="mr-2 h-4 w-4" />
              Add Material
            </Button>
          </Link>
        </div>
      </div>

      <EconomyDashboard />

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">Pick up where you left off</p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Continue studying</h2>
          </div>
          <Link href="/upload" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Add material</Link>
        </div>
        {success && documents && documents.length > 0 ? (
          <Link href={`/documents/${documents[0].document.id}${documents[0].extraction.status === "completed" ? "" : "/process"}`} className="flex items-center justify-between gap-4 rounded-xl bg-indigo-50 p-4 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{documents[0].document.filename}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Last added {new Date(documents[0].document.createdAt).toLocaleDateString()}</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-indigo-700 dark:text-indigo-300">Continue →</span>
          </Link>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Upload your first study material and it will appear here.</p>
        )}
      </section>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {/* Total Cards */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Cards</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Brain className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mt-4">0</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">In your collection</p>
          </div>
        </div>

        {/* Cards Mastered */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Cards Mastered</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mt-4">0</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">0% of total</p>
          </div>
        </div>

        {/* Reviews Pending */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Reviews Pending</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mt-4">0</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Due today or overdue</p>
          </div>
        </div>

      </div>

      <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Review due</h2>
      {/* Middle Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900 dark:text-white">Overdue</span>
            <span className="flex h-5 items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 text-xs font-medium text-red-700 dark:text-red-400">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-500"></span> 0
            </span>
          </div>
          <div className="mt-6">
            <div className="text-3xl font-bold text-red-600 dark:text-red-500">0</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cards need review</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900 dark:text-white">Due Today</span>
            <span className="flex h-5 items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500"></span> 0
            </span>
          </div>
          <div className="mt-6">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">0</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review scheduled</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900 dark:text-white">Upcoming</span>
            <span className="flex h-5 items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span> 0
            </span>
          </div>
          <div className="mt-6">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500">0</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Future reviews</p>
          </div>
        </div>
      </div>

      <MedeaWelcomeCard />

      {/* Recent Documents */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Recent materials</h2>
        {(!success || !documents || documents.length === 0) ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 text-center shadow-sm">
            <Brain className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No cards due today</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              Great job! You're all caught up. Add more material to continue learning.
            </p>
            <Link
              href="/upload"
              className="mt-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
            >
              Upload a document
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
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentLifecycleSummary }) {
  const { document, notes, quiz } = doc;
  const isFailed = doc.extraction.status === 'failed' || doc.extraction.status === 'cancelled';
  const isReady = doc.extraction.status === 'completed';
  const isProcessing = ['uploaded', 'queued', 'extracting', 'analyzing', 'generating'].includes(doc.extraction.status || '');
  const needsAttention = notes?.status === 'inconsistent' || quiz?.status === 'inconsistent' || notes?.status === 'failed' || quiz?.status === 'failed';

  const notesReady = notes?.status === 'ready';
  const quizReady = quiz?.status === 'ready';

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
          <StatusBadge isReady={isReady} isProcessing={isProcessing} isFailed={isFailed} needsAttention={needsAttention} />
        </div>
        
        <h3 className="mt-4 truncate text-base font-semibold text-slate-900 dark:text-white" title={document.filename}>
          {document.filename}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {new Date(document.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>

        {isFailed && doc.extraction.errorMessage && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 line-clamp-2">
            {doc.extraction.errorMessage}
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
            <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md">
              Review Due
            </span>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ isReady, isProcessing, isFailed, needsAttention }: any) {
  if (isFailed) return <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/10 dark:ring-red-500/20"><AlertCircle className="mr-1 h-3 w-3" />Failed</span>;
  if (needsAttention) return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/10 dark:ring-amber-500/20"><AlertCircle className="mr-1 h-3 w-3" />Needs</span>;
  if (isProcessing) return <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/10 dark:ring-blue-500/20"><Clock className="mr-1 h-3 w-3" />Processing</span>;
  if (isReady) return <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/10 dark:ring-emerald-500/20"><CheckCircle2 className="mr-1 h-3 w-3" />Ready</span>;
  return null;
}
