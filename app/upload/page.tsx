"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CloudUpload, FileText, Video } from "lucide-react";

export default function UploadPage() {
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [error, setError] = useState("");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMediaFile = (file: File) =>
    file.type.startsWith("video/") || file.type.startsWith("audio/");

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError("");
    setStatus("extracting");

    try {
      let combinedText = "";
      const fileNames = [];

      // Loop through every uploaded file and extract text sequentially
      for (const file of files) {
        fileNames.push(file.name);
        const form = new FormData();
        form.append("file", file);

        const endpoint = isMediaFile(file) ? "/api/transcribe" : "/api/extract-text";
        const extractRes = await fetch(endpoint, { method: "POST", body: form });
        const extractData = await extractRes.json();

        if (!extractRes.ok) {
          throw new Error(extractData.error || `Failed to read ${file.name}`);
        }
        
        // Append text with a divider so the AI knows where one file ends and another begins
        combinedText += `\n\n--- Content from ${file.name} ---\n\n${extractData.text}`;
      }

      setStatus("generating");
      
      // Send the combined payload to the AI
      const genRes = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combinedText, fileName: fileNames.join(", ") })
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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (status !== "idle") return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || status !== "idle") return;
    processFiles(Array.from(e.target.files));
  };

  return (
    <div className="mx-auto max-w-3xl py-12 px-4 transition-colors duration-200">
      
      <div className="mb-8 text-center sm:text-left px-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          Upload your materials
        </h1>
        <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
          Select multiple PDFs, documents, or media files. We'll combine them into one study session.
        </p>
      </div>

      <div className="relative">
        {/* Native Dropzone built directly into the page */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => status === "idle" && fileInputRef.current?.click()}
          className={`bg-white dark:bg-slate-900 border-2 border-dashed ${status === "idle" ? "border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer" : "border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed"} rounded-3xl p-10 text-center transition-colors`}
        >
          <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
            <CloudUpload className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Drop files or click to upload
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Upload as many files as you need at the same time
          </p>
          <div className="flex justify-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4"/> Documents</span>
            <span className="flex items-center gap-1.5"><Video className="w-4 h-4"/> Video / Audio</span>
          </div>

          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            disabled={status !== "idle"}
          />
        </div>
      </div>

      {status !== "idle" && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60 shadow-sm animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin" />
          {status === "extracting" 
            ? "Extracting text from all files..." 
            : "Generating combined notes and questions..."}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl bg-rose-50/80 dark:bg-rose-950/50 backdrop-blur-md px-6 py-4 text-sm font-semibold text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50 text-center shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}