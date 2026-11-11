"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, BrainCircuit, BookOpen, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import FileUploader from "@/components/FileUploader";

import { processFileClientSide } from "@/lib/client-parser";

export default function UploadPage() {
  const [step, setStep] = useState<"upload" | "configure">("upload");
  const [status, setStatus] = useState<"idle" | "extracting" | "generating">("idle");
  const [extractedText, setExtractedText] = useState("");
  const [fileName, setFileName] = useState("");
  
  const [studyMode, setStudyMode] = useState<"quiz" | "notes">("quiz");
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  
  const [error, setError] = useState("");
  const router = useRouter();
  const { isPremium } = useAppStore();

  const maxLimit = isPremium ? 50 : 30;
  
  // SPEED OPTIMIZATION: Reduced from 15000 to 8000 to guarantee it processes before Vercel times out.
  const MAX_AI_CHARS = 8000; 

  useEffect(() => {
    const rawContent = sessionStorage.getItem("recallmate-content");
    const shouldReconfigure = sessionStorage.getItem("recallmate-reconfigure");
    
    if (rawContent) {
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed.text || rawContent) {
          setFileName(parsed.fileName || "Uploaded Material");
        }
      } catch (e) {}
    }

    if (shouldReconfigure === "true" && rawContent) {
      setStep("configure");
      sessionStorage.removeItem("recallmate-reconfigure");
    }
  }, []);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError("");
    setStatus("extracting");

    try {
      let combinedText = "";
      const fileNames = [];
      
      for (const rawFile of files) {
        let originalName = rawFile.name || "upload";
        fileNames.push(originalName);
        let extractedTextForFile = await processFileClientSide(rawFile);

        combinedText += `\n\n--- Content from ${originalName} ---\n\n${extractedTextForFile}`;
      }

      setExtractedText(combinedText);
      setFileName(fileNames.join(", "));
      setStatus("idle");
      setStep("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    } finally {
      setStatus((prev) => (prev === "extracting" ? "idle" : prev));
    }
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setError("");

    try {
      let textToSend = extractedText;
      if (!textToSend) {
        textToSend = "User generated session content based on previous upload.";
      }

      // Final guarantee the payload is small enough for Vercel to process quickly
      if (textToSend.length > MAX_AI_CHARS) {
        textToSend = textToSend.substring(0, MAX_AI_CHARS) + "\n\n[Note: Content truncated for speed.]";
      }

      const controller = new AbortController();
      // Increased to 90 seconds to ensure the frontend never prematurely kills the request
      const timeoutId = setTimeout(() => controller.abort(), 90000); 

      try {
        const genRes = await fetch("/api/generate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textToSend,
            fileName: fileName || "Study Material",
            count: questionCount,
            difficulty: selectedDifficulty,
            isPremium: isPremium
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // VERCEL TIMEOUT FIX: Check for 504 Gateway Timeout specifically before parsing JSON
        if (!genRes.ok) {
          if (genRes.status === 504) {
            throw new Error("Vercel Timeout (504): The AI is taking longer than Vercel's 10-second server limit to write the quiz. Please reduce the number of questions.");
          }
          
          let errText = await genRes.text();
          let errData;
          try { errData = JSON.parse(errText); } catch(e) {}
          throw new Error(errData?.error || `Server Error ${genRes.status}: Failed to generate study content.`);
        }

        const genData = await genRes.json();
        sessionStorage.setItem("recallmate-content", JSON.stringify(genData));
        
        if (studyMode === "quiz") {
          router.push("/quiz");
        } else {
          router.push("/notes");
        }

      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error("The AI took too long to respond. Try reducing the question count or uploading a shorter document.");
        }
        throw fetchErr;
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-12 px-4 transition-colors duration-200">
      
      {step === "configure" && (
        <button 
          onClick={() => setStep("upload")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Choose Different Files
        </button>
      )}

      <div className="mb-8 text-center sm:text-left px-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          {step === "upload" ? "Upload your materials" : "Choose Your Study Options"}
        </h1>
        <p className="mt-2 text-base font-medium text-slate-600 dark:text-slate-400">
          {step === "upload" 
            ? "Select files to begin your AI study session." 
            : `Configuring options for: ${fileName}`}
        </p>
      </div>

      {step === "upload" ? (
        <>
          <FileUploader 
            onFileSelected={(file) => processFiles([file])} 
            disabled={status !== "idle"} 
          />

          {status === "extracting" && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-slate-900/60 backdrop-blur-md px-6 py-4 text-sm font-bold text-indigo-400 border border-slate-700/60 shadow-sm animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin" />
              Extracting text from your files...
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8 shadow-sm">
          
          <div>
            <label className="block text-sm font-bold text-white mb-3">
              Select Study Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStudyMode("quiz")}
                className={`py-4 px-5 rounded-2xl font-bold border-2 flex items-center justify-center gap-3 transition-all ${
                  studyMode === "quiz"
                    ? "bg-indigo-500 border-indigo-500 text-white shadow-md"
                    : "bg-slate-950 border-slate-800 text-slate-300"
                }`}
              >
                <BrainCircuit className="w-5 h-5" /> Quiz Mode
              </button>
              <button
                onClick={() => setStudyMode("notes")}
                className={`py-4 px-5 rounded-2xl font-bold border-2 flex items-center justify-center gap-3 transition-all ${
                  studyMode === "notes"
                    ? "bg-indigo-500 border-indigo-500 text-white shadow-md"
                    : "bg-slate-950 border-slate-800 text-slate-300"
                }`}
              >
                <BookOpen className="w-5 h-5" /> Notes Mode
              </button>
            </div>
          </div>

          {studyMode === "quiz" && (
            <div className="space-y-6 pt-4 border-t border-slate-800 animate-in fade-in duration-200">
              <div>
                <label className="block text-sm font-bold text-white mb-3">
                  Quiz Difficulty
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy", "medium", "hard"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedDifficulty(level)}
                      className={`py-3 px-4 rounded-xl font-bold capitalize border-2 transition-all ${
                        selectedDifficulty === level
                          ? "bg-indigo-500 border-indigo-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-300"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-white">
                    Number of Questions ({questionCount})
                  </label>
                  <span className="text-xs font-semibold text-slate-400">
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

          <button
            onClick={handleGenerate}
            disabled={status === "generating"}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all"
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
        <div className="mt-6 rounded-2xl bg-rose-950/50 backdrop-blur-md px-6 py-4 text-sm font-semibold text-rose-400 border border-rose-900/50 text-center shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}