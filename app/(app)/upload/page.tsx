"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import FileUploader from "@/components/FileUploader";
import { createClient } from "@/utils/supabase/client";
import { 
  createDocumentUploadSession, 
  confirmDocumentUpload 
} from "@/app/actions/document-actions";
import { useAppStore } from "@/lib/store";

export default function UploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { isPremium } = useAppStore();

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
    <div className="mx-auto max-w-3xl py-12 px-4 transition-colors duration-200">
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upload Study Material</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Upload your lecture notes, textbook chapters, or clinical guidelines to generate AI-powered study materials.
          </p>
        </div>

        {error && (
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
        <div aria-live="polite" className="sr-only">
          {isUploading ? uploadStatus : ""}
        </div>

        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <Loader2 className="h-10 w-10 motion-safe:animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white" aria-live="off">{uploadStatus}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Please keep this tab open</p>
          </div>
        ) : (
          <FileUploader onFileSelected={processFile} />
        )}
      </div>
    </div>
  );
}