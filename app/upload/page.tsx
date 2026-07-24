"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import FileUploader from "@/components/FileUploader";

export default function UploadPage() {
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const isMediaFile = (file: File) =>
    file.type.startsWith("video/") || file.type.startsWith("audio/");

  const handleFile = async (file: File) => {
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);

      setStatus("extracting");
      const endpoint = isMediaFile(file) ? "/api/transcribe" : "/api/extract-text";
      const extractRes = await fetch(endpoint, { method: "POST", body: form });
      const extractData = await extractRes.json();

      if (!extractRes.ok) {
        throw new Error(extractData.error || "Failed to read file.");
      }

      setStatus("generating");
      const genRes = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractData.text, fileName: file.name })
      });
      const genData = await genRes.json();

      if (!genRes.ok) {
        throw new Error(genData.error || "Failed to generate study content.");
      }

      sessionStorage.setItem("recallmate-content", JSON.stringify(genData));
      router.push("/quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 transition-colors duration-200">
      
      {/* 1. FIXED VISIBILITY: Added dark mode text colors */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          Upload your material
        </h1>
        <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
          We'll extract the content and generate notes plus active recall questions.
        </p>
      </div>

      <div className="relative">
        <FileUploader onFileSelected={handleFile} disabled={status !== "idle"} />
      </div>

      {/* 2. MODERN LOADING STATE: Added glassmorphic blur and theme support */}
      {status !== "idle" && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60 shadow-sm animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin" />
          {status === "extracting" 
            ? "Reading your file..." 
            : "Generating notes and questions... Almost done!"}
        </div>
      )}

      {/* 3. MODERN ERROR STATE: Added visibility and theme support */}
      {error && (
        <div className="mt-6 rounded-2xl bg-rose-50/80 dark:bg-rose-950/50 backdrop-blur-md px-6 py-4 text-sm font-semibold text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50 text-center shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}