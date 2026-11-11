"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, BrainCircuit, BookOpen, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import FileUploader from "@/components/FileUploader";

// ULTIMATE iOS FIX: A rock-solid legacy file reader that bypasses the WebKit arrayBuffer() crash
const readFileSafely = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Browser failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

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
  const { isPremium } = useAppStore();

  const maxLimit = isPremium ? 50 : 30;

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

  const isMediaFile = (file: File) =>
    file.type.startsWith("video/") || file.type.startsWith("audio/");

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError("");
    setStatus("extracting");

    try {
      let combinedText = "";
      const fileNames = [];
      
      let pdfjsLib: any = null;
      let mammothLib: any = null;

      for (const file of files) {
        fileNames.push(file.name);
        const fileName = file.name.toLowerCase();
        let extractedTextForFile = "";
        let clientSideFailed = false;

        // ==========================================
        // 1. CLIENT-SIDE EXTRACTION 
        // ==========================================
        try {
          if (fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv")) {
            extractedTextForFile = await file.text();
          } 
          else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
            if (!mammothLib) {
              const mammothModule = await import("mammoth");
              mammothLib = mammothModule.default || mammothModule;
            }
            const arrayBuffer = await readFileSafely(file);
            const result = await mammothLib.extractRawText({ arrayBuffer });
            extractedTextForFile = result.value;
          }
          else if (fileName.endsWith(".pptx")) {
            const zipModule = await import("jszip");
            const JSZip = zipModule.default || zipModule;
            const zip = new (JSZip as any)();
            
            const arrayBuffer = await readFileSafely(file);
            const loadedZip = await zip.loadAsync(arrayBuffer);
            
            for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
              if (relativePath.startsWith("ppt/slides/slide") && relativePath.endsWith(".xml")) {
                const xmlContent = await (zipEntry as any).async("string");
                const textMatches = xmlContent.match(/<a:t>([\s\S]*?)<\/a:t>/g);
                if (textMatches) {
                  const slideText = textMatches.map((match: string) => match.replace(/<\/?a:t>/g, '')).join(" ");
                  extractedTextForFile += slideText + "\n";
                }
              }
            }
            if (!extractedTextForFile.trim()) {
              extractedTextForFile = "[Presentation contained no readable text]";
            }
          }
          else if (fileName.endsWith(".pdf")) {
            if (!pdfjsLib) {
              const pdfjsModule = await import("pdfjs-dist");
              pdfjsLib = pdfjsModule.default || pdfjsModule;
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
            }
            
            const arrayBuffer = await readFileSafely(file);
            const uint8Array = new Uint8Array(arrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
            
            const maxPages = Math.min(pdf.numPages, 50);
            const batchSize = 3; 
            
            for (let i = 1; i <= maxPages; i += batchSize) {
              const batchPromises = [];
              for (let j = i; j < i + batchSize && j <= maxPages; j++) {
                batchPromises.push(
                  pdf.getPage(j).then(async (page: any) => {
                    try {
                      const textContent = await page.getTextContent();
                      const text = textContent.items.map((item: any) => item.str).join(" ");
                      page.cleanup(); 
                      return text;
                    } catch (err) {
                      console.warn(`Failed to read page ${j}`, err);
                      return "";
                    }
                  })
                );
              }
              const batchResults = await Promise.all(batchPromises);
              extractedTextForFile += batchResults.join("\n") + "\n";
              
              await new Promise(resolve => setTimeout(resolve, 15));
            }
            
            pdf.destroy();

            if (pdf.numPages > 50) {
              extractedTextForFile += "\n[System Note: The PDF was truncated to the first 50 pages to optimize AI memory and processing speed.]\n";
            }
          }
        } catch (clientErr) {
          console.error("Client browser failed to read file, routing to server backend...", clientErr);
          clientSideFailed = true; 
        }

        // ==========================================
        // 2. SERVER-SIDE FALLBACK
        // ==========================================
        if (
          clientSideFailed || 
          (!fileName.endsWith(".txt") && !fileName.endsWith(".md") && !fileName.endsWith(".csv") && 
           !fileName.endsWith(".docx") && !fileName.endsWith(".doc") && 
           !fileName.endsWith(".pdf") && !fileName.endsWith(".pptx"))
        ) {
          
          if (file.size > 4.5 * 1024 * 1024) {
            throw new Error(`"${file.name}" is too large. Server extraction limit is 4.5MB.`);
          }

          const form = new FormData();
          
          // CRITICAL SAFARI FIX 2: Override the original filename in FormData.
          // This strips all hidden emojis, accents, and invalid characters that crash iOS network requests.
          const extMatch = fileName.match(/\.[0-9a-z]+$/i);
          const safeExt = extMatch ? extMatch[0] : ".bin";
          const safeName = `upload_file${safeExt}`;
          
          form.append("file", file, safeName);
          
          const endpoint = isMediaFile(file) ? "/api/transcribe" : "/api/extract-text";
          
          const extractRes = await fetch(endpoint, { method: "POST", body: form });
          
          const contentType = extractRes.headers.get("content-type");
          let extractData;
          if (contentType && contentType.includes("application/json")) {
            extractData = await extractRes.json();
          } else {
            throw new Error(
              extractRes.status === 413 
                ? "File is too large for the server to process." 
                : "The server returned an unexpected error format."
            );
          }

          if (!extractRes.ok) {
            throw new Error(extractData.error || `Failed to read ${file.name}`);
          }
          
          extractedTextForFile = extractData.text;
        }

        combinedText += `\n\n--- Content from ${file.name} ---\n\n${extractedTextForFile}`;
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
      let textToSend = extractedText;
      if (!textToSend) {
        textToSend = "User generated session content based on previous upload.";
      }

      const genRes = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSend,
          fileName: fileName || "Study Material",
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
                      {level} {level === "hard" && "🔥"}
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