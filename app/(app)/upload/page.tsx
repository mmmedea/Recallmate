"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertCircle, Layers3, Printer, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import FileUploader from "@/components/FileUploader";
import { createClient } from "@/utils/supabase/client";
import { 
  createDocumentUploadSession, 
  confirmDocumentUpload 
} from "@/app/actions/document-actions";
import ManualFlashcardBuilder from "@/components/study/ManualFlashcardBuilder";
import ReviewerPdfMaker from "@/components/reviewer/ReviewerPdfMaker";

export default function UploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"upload" | "flashcards" | "reviewer">("upload");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "flashcards" || requestedMode === "reviewer") setMode(requestedMode);
  }, []);

  const processFile = async (file: File) => {
    setError("");
    setIsUploading(true);
    setUploadStatus("Initializing upload...");

    try {
      // 1. Create Upload Session
      const sessionRes = await createDocumentUploadSession({
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream"
      });

      if (!sessionRes.success || !sessionRes.documentId || !sessionRes.storagePath) {
        throw new Error(sessionRes.error || "Failed to initiate upload");
      }

      setUploadStatus("Uploading file...");

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('study_materials')
        .upload(sessionRes.storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw new Error("Storage upload failed: " + uploadError.message);
      
      setUploadStatus("Finalizing...");

      // 3. Confirm Upload & Queue Processing (Transactional RPC)
      const idempotencyKey = `process:${sessionRes.documentId}:v1`;
      const confirmRes = await confirmDocumentUpload(sessionRes.documentId, idempotencyKey);

      if (!confirmRes.success) {
        throw new Error(confirmRes.error || "Failed to confirm upload");
      }

      setUploadStatus("Redirecting to workspace...");

      // 4. Redirect immediately to the processing workspace
      router.push(`/documents/${sessionRes.documentId}/process`);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 transition-colors duration-200 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link 
          href="/dashboard"
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-white via-indigo-50 to-violet-100 p-6 dark:border-indigo-500/20 dark:from-slate-900 dark:via-indigo-950/40 dark:to-violet-950/40 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600">Study creator</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white sm:text-4xl">Upload, quiz, or build flashcards</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Use one workspace to turn a file into AI notes and quizzes, or create your own tap-to-flip flashcard deck.
          </p>
        </div>

        <div role="tablist" aria-label="Study creation method" className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
          <button role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${mode === "upload" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><UploadCloud className="h-4 w-4" />Upload & AI quiz</button>
          <button role="tab" aria-selected={mode === "flashcards"} onClick={() => setMode("flashcards")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${mode === "flashcards" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Layers3 className="h-4 w-4" />Create flashcards</button>
          <button role="tab" aria-selected={mode === "reviewer"} onClick={() => setMode("reviewer")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${mode === "reviewer" ? "bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Printer className="h-4 w-4" />Reviewer PDF</button>
        </div>

        {mode === "upload" && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20" role="alert">
            <div className="flex items-start">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="ml-3 text-sm text-red-600 dark:text-red-400">
                <p className="font-semibold">Upload failed</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Live region for accessibility announcements */}
        {mode === "upload" && <div aria-live="polite" className="sr-only">
          {isUploading ? uploadStatus : ""}
        </div>}

        {mode === "reviewer" ? <ReviewerPdfMaker /> : mode === "flashcards" ? <ManualFlashcardBuilder /> : isUploading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <Loader2 className="h-10 w-10 motion-safe:animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white" aria-live="off">{uploadStatus}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Please keep this tab open</p>
          </div>
        ) : (
          <div className="space-y-4"><div className="flex items-center gap-2 text-sm font-bold text-indigo-600"><Sparkles className="h-4 w-4" />Medea will generate organized notes and a quiz after upload.</div><FileUploader onFileSelected={processFile} /></div>
        )}
      </div>
    </div>
  );
}
