"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CloudUpload, FileText, Sparkles, BrainCircuit, BookOpen } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function UploadPage() {
  const [step, setStep] = useState<"upload" | "configure">("upload");
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [extractedText, setExtractedText] = useState("");
  const [fileName, setFileName] = useState("");
  
  // Configuration options
  const [studyMode, setStudyMode] = useState<"quiz" | "notes">("quiz");
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  
  const [error, setError] = useState("");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isPremium } = useAppStore();

  const maxLimit = isPremium ? 50 : 30;

  const isMediaFile = (file: File) =>
    file.type.startsWith("video/") || file.type.startsWith("audio/");

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError("");
    setStatus("extracting");

    try {
      let combinedText = "";
      const fileNames = [];

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
        
        combinedText += `\n\n--- Content from ${file.name} ---\n\n${extractData.text}`;
      }

      setExtractedText(combinedText);
      setFileName(fileNames.join(", "));
      setStatus("idle");
      setStep("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setError("");

    try {
      const genRes = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          fileName: fileName,
          count: questionCount,
          difficulty: selectedDifficulty,
          isPremium: isPremium
        })
      });

      const genData = await genRes.json();

      if (!genRes.ok) {
        throw new Error(genData.error || "Failed to generate study content.");
      }

      sessionStorage.setItem("recallmate-content", JSON.stringify(genData));
      
      // Route based on user's mode choice
      if (studyMode === "quiz") {
        router.push("/quiz");
      } else {
        router.push("/notes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-12 px-4 transition-colors duration-200">
      
      <div className="mb-8 text-center sm:text-left px-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          {step === "upload" ? "Upload your materials" : "Choose Your Study Mode"}
        </h1>
        <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
          {step === "upload" 
            ? "Select files to begin your AI study session." 
            : "Select whether you want to test your knowledge with a quiz or review detailed notes."}
        </p>
      </div>

      {step === "upload" ? (
        <>
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); processFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => status === "idle" && fileInputRef.current?.click()}
            className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-3xl p-10 text-center cursor-pointer transition-colors"
          >
            <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
              <CloudUpload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Drop files or click to upload
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Supports PDFs, Documents, and Media files
            </p>
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))} 
              className="hidden" 
            />
          </div>

          {status === "extracting" && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60 shadow-sm animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin" />
              Extracting text from your files...
            </div>
          )}
        </>
      ) : (
        /* CONFIGURATION STEP WITH MODE SELECTOR */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-8 shadow-sm">
          
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-3">
              Select Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStudyMode("quiz")}
                className={`py-4 px-5 rounded-2xl font-bold border-2 flex items-center justify-center gap-3 transition-all ${
                  studyMode === "quiz"
                    ? "bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500 shadow-md"
                    : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
                }`}
              >
                <BrainCircuit className="w-5 h-5" /> Quiz Mode
              </button>
              <button
                onClick={() => setStudyMode("notes")}
                className={`py-4 px-5 rounded-2xl font-bold border-2 flex items-center justify-center gap-3 transition-all ${
                  studyMode === "notes"
                    ? "bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500 shadow-md"
                    : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
                }`}
              >
                <BookOpen className="w-5 h-5" /> Notes Mode
              </button>
            </div>
          </div>

          {/* Conditional Quiz Options */}
          {studyMode === "quiz" && (
            <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white mb-3">
                  Quiz Difficulty
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy", "medium", "hard"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedDifficulty(level)}
                      className={`py-3 px-4 rounded-xl font-bold capitalize border-2 transition-all ${
                        selectedDifficulty === level
                          ? "bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500"
                          : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {level} {level === 'hard' && '🔥'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-slate-900 dark:text-white">
                    Number of Questions ({questionCount})
                  </label>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Max limit: {maxLimit} questions
                  </span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max={maxLimit} 
                  step="5"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={status === "generating"}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all"
          >
            {status === "generating" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing your session...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {studyMode === "quiz" ? "Start Quiz Session" : "View Detailed Notes"}
              </>
            )}
          </button>
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