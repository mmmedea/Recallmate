"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertCircle, Layers3, Printer, UploadCloud } from "lucide-react";
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
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 font-nunito sm:px-6 sm:py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-white/50 transition hover:text-[#d9c8ff]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-[#a78bfa]/25 bg-[radial-gradient(ellipse_at_85%_10%,rgba(244,63,94,.20),transparent_38%),linear-gradient(130deg,#1a1224,#100d18_58%,#160d18)] p-7 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:p-10">
          <p className="font-pixelify text-[10px] uppercase tracking-[0.24em] text-[#ff8799]">YOUR CREATION STUDIO</p>
          <h1 className="mt-3 font-fredoka text-3xl font-semibold text-white sm:text-4xl">Create your next study tool.</h1>
          <p className="mt-3 max-w-2xl font-quicksand text-sm leading-6 text-white/60 sm:text-base">
            Use one workspace to turn a file into AI notes and quizzes, or create your own tap-to-flip flashcard deck.
          </p>
        </div>

        <div role="tablist" aria-label="Study creation method" className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-[#111019] p-2 shadow-xl shadow-black/10 sm:grid-cols-3">
          <button role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${mode === "upload" ? "bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd] text-[#160f20] shadow-lg shadow-[#a78bfa]/20" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}><UploadCloud className="h-4 w-4" />Upload & AI quiz</button>
          <button role="tab" aria-selected={mode === "flashcards"} onClick={() => setMode("flashcards")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${mode === "flashcards" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Layers3 className="h-4 w-4" />Create flashcards</button>
          <button role="tab" aria-selected={mode === "reviewer"} onClick={() => setMode("reviewer")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${mode === "reviewer" ? "bg-gradient-to-r from-[#fb7185] to-[#f43f5e] text-white shadow-lg shadow-[#f43f5e]/20" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}><Printer className="h-4 w-4" />Reviewer PDF</button>
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
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#a78bfa]/30 bg-[#111019] py-16">
            <Loader2 className="h-10 w-10 motion-safe:animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
            <h3 className="font-fredoka text-xl font-semibold text-white" aria-live="off">{uploadStatus}</h3>
            <p className="mt-2 font-quicksand text-sm text-white/45">Please keep this tab open</p>
          </div>
        ) : (
          <div className="space-y-4"><div className="rounded-2xl border border-[#a78bfa]/20 bg-[#a78bfa]/[0.07] px-4 py-3 font-quicksand text-sm text-[#d9c8ff]">Upload a lesson file and Medea will organize it into study-ready notes and practice questions.</div><FileUploader onFileSelected={processFile} /></div>
        )}
      </div>
    </div>
  );
}
