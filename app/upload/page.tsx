"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, BrainCircuit, BookOpen, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import FileUploader from "@/components/FileUploader";

// Safe legacy file reader (Only used for small text files now)
const readFileSafely = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Browser failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

// Auto-compress large images to bypass the 4.5MB server limit
const compressImage = (file: File | Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxDim = 1500; // Cap resolution to save massive amounts of data
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Compression failed"));
      }, "image/jpeg", 0.7); // 70% quality JPEG is perfect for AI OCR
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
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
  const MAX_AI_CHARS = 15000; // Cap text to ensure AI stays well under 10s timeout

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
      
      let pdfjsLib: any = null;
      let mammothLib: any = null;

      for (const rawFile of files) {
        let originalName = rawFile.name || "upload";
        let tempFileName = originalName.toLowerCase();
        
        let extMatch = tempFileName.match(/\.[0-9a-z]+$/i);
        let ext = extMatch ? extMatch[0] : "";

        const mime = (rawFile.type || "").toLowerCase();
        if (!ext || !['.txt','.md','.csv','.doc','.docx','.pdf','.pptx','.jpg','.jpeg','.png','.webp','.mp4','.mp3'].includes(ext)) {
          if (mime.includes("pdf")) ext = ".pdf";
          else if (mime.includes("presentation") || mime.includes("powerpoint")) ext = ".pptx";
          else if (mime.includes("word") || mime.includes("document")) ext = ".docx";
          else if (mime.includes("text/plain")) ext = ".txt";
          else if (mime.includes("csv")) ext = ".csv";
          else if (mime.includes("image/jpeg")) ext = ".jpg";
          else if (mime.includes("image/png")) ext = ".png";
          else ext = ".bin"; 
          
          tempFileName = `upload${ext}`;
        }

        fileNames.push(originalName);
        const safeFileName = `file_${Date.now()}${ext}`;
        let extractedTextForFile = "";
        let clientSideFailed = false;

        // ==========================================
        // 1. CLIENT-SIDE EXTRACTION (ZERO-MEMORY SPIKE FIX)
        // ==========================================
        const runClientExtraction = async (): Promise<string> => {
          let resultText = "";

          // DOCX and TXT are inherently small, safe to use ArrayBuffer
          if (ext === ".txt" || ext === ".md" || ext === ".csv" || ext === ".docx" || ext === ".doc") {
            const arrayBuffer = await readFileSafely(rawFile);
            
            if (ext === ".txt" || ext === ".md" || ext === ".csv") {
              const textDecoder = new TextDecoder("utf-8");
              resultText = textDecoder.decode(arrayBuffer);
            } else {
              if (!mammothLib) {
                const mammothModule = await import("mammoth");
                mammothLib = mammothModule.default || mammothModule;
              }
              const result = await mammothLib.extractRawText({ arrayBuffer });
              resultText = result.value;
            }
          }
          else if (ext === ".pptx") {
            const zipModule = await import("jszip");
            const JSZip = zipModule.default || zipModule;
            const zip = new (JSZip as any)();
            
            // PPTX FIX: JSZip natively reads raw File objects without loading into RAM
            const loadedZip = await zip.loadAsync(rawFile);
            
            for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
              if (relativePath.startsWith("ppt/slides/slide") && relativePath.endsWith(".xml")) {
                const xmlContent = await (zipEntry as any).async("string");
                const textMatches = xmlContent.match(/<a:t>([\s\S]*?)<\/a:t>/g);
                if (textMatches) {
                  const slideText = textMatches.map((match: string) => match.replace(/<\/?a:t>/g, '')).join(" ");
                  resultText += slideText + "\n";
                }
              }
              if (resultText.length > MAX_AI_CHARS) break; 
            }
          }
          else if (ext === ".pdf") {
            if (!pdfjsLib) {
              const pdfjsModule = await import("pdfjs-dist");
              pdfjsLib = pdfjsModule.default || pdfjsModule;
              try {
                const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                const workerRes = await fetch(workerUrl);
                const workerBlob = await workerRes.blob();
                pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
              } catch (workerErr) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
              }
            }
            
            // 10MB+ PDF FIX: Create a local URL stream instead of loading raw bytes into RAM
            const objectUrl = URL.createObjectURL(rawFile);
            
            const loadingTask = pdfjsLib.getDocument({
              url: objectUrl,
              isEvalSupported: false,
            });

            const pdf = await loadingTask.promise;
            const maxPages = Math.min(pdf.numPages, 100);
            
            for (let i = 1; i <= maxPages; i++) {
              try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(" ");
                resultText += pageText + "\n";
                page.cleanup();
                
                if (resultText.length > MAX_AI_CHARS) break;
              } catch (e) {}
            }
            pdf.destroy();
            URL.revokeObjectURL(objectUrl); // Clean up stream memory
          }

          return resultText;
        };

        try {
          extractedTextForFile = await Promise.race([
            runClientExtraction(),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error("Extraction timed out")), 60000)
            )
          ]);
        } catch (clientErr) {
          console.warn("Client extraction timed out or failed, falling back to server...", clientErr);
          clientSideFailed = true;
        }

        // ==========================================
        // 2. SERVER-SIDE FALLBACK / IMAGE COMPRESSION
        // ==========================================
        
        const isTextEmpty = !extractedTextForFile.trim();

        if (
          clientSideFailed || 
          isTextEmpty ||
          (![".txt", ".md", ".csv", ".doc", ".docx", ".pdf", ".pptx"].includes(ext))
        ) {
          
          let fileToSend: File | Blob = rawFile;

          // HUGE FIX: If they upload an oversized Image, compress it down instantly!
          if (rawFile.size > 4.5 * 1024 * 1024 && [".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
            try {
              fileToSend = await compressImage(rawFile);
            } catch (err) {
              console.warn("Failed to compress image locally");
            }
          }

          if (fileToSend.size > 4.5 * 1024 * 1024) {
            if (ext === ".pdf" && isTextEmpty && !clientSideFailed) {
               throw new Error(`"${originalName}" appears to be a scanned document containing only images. It is over the 4.5MB server limit for image scanning. Please compress the file or upload a text-based PDF.`);
            }
            if (clientSideFailed) {
              throw new Error(`"${originalName}" timed out while processing on your device. It is too large to send to the backup server (${(rawFile.size / 1024 / 1024).toFixed(1)}MB). Please open this site in normal Safari/Chrome!`);
            }
            throw new Error(`"${originalName}" is too large. Server extraction limit is 4.5MB.`);
          }

          let safeMime = "application/octet-stream";
          if (ext === ".jpg" || ext === ".jpeg") safeMime = "image/jpeg";
          else if (ext === ".png") safeMime = "image/png";
          else if (ext === ".webp") safeMime = "image/webp";
          else if (ext === ".mp4") safeMime = "video/mp4";
          else if (ext === ".mp3") safeMime = "audio/mpeg";
          else if (ext === ".pdf") safeMime = "application/pdf";
          else if (ext === ".pptx") safeMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          else if (ext === ".docx") safeMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

          // Construct pristine Blob to prevent OS/Browser metadata conflicts
          const pristineBlob = new Blob([fileToSend], { type: safeMime });
          const form = new FormData();
          form.append("file", pristineBlob, safeFileName);
          
          const isMedia = safeMime.startsWith("video/") || safeMime.startsWith("audio/");
          const endpoint = isMedia ? "/api/transcribe" : "/api/extract-text";
          
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
            throw new Error(extractData.error || `Failed to read ${originalName}`);
          }
          
          extractedTextForFile = extractData.text;
        }

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

      if (textToSend.length > MAX_AI_CHARS) {
        textToSend = textToSend.substring(0, MAX_AI_CHARS) + "\n\n[Note: Content truncated for speed.]";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);

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