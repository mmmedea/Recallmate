"use client";

import { useState } from "react";
import { Sparkles, Brain, Heart, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import FileUploader from "@/components/FileUploader";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState<number>(10);
  const [quizData, setQuizData] = useState<any>(null);

  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setQuizData(null);
  };

  const handleGenerate = async () => {
    if (!file) {
      setError("Please upload a file first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Read file text contents
      let extractedText = "";

      // Handle plain text files directly
      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        extractedText = await file.text();
      } else {
        // Fallback text reader (Ensure your PDF/DOCX parser sets extractedText if using a client-side library)
        extractedText = await file.text();
      }

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error("Could not extract readable text from this file. Please ensure your document contains selectable text.");
      }

      // 2. Send payload to API route
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: extractedText,
          fileName: file.name,
          count: count,
          difficulty: difficulty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate study content.");
      }

      // 3. Save generated output
      setQuizData(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong while processing your file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[85vh] flex flex-col justify-center items-center text-center space-y-10 py-10 transition-colors duration-300">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/50 backdrop-blur-md shadow-sm">
        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-bold tracking-wide text-indigo-700 dark:text-indigo-300 uppercase">
          Predictive Exam AI + Active Recall
        </span>
      </div>

      {/* Heading */}
      <div className="max-w-3xl space-y-4 px-4">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Turn any document into an exam questionnaire you'll{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
            master.
          </span>
        </h1>
        <p className="text-base sm:text-lg font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Upload a PDF, PPT, DOCX, or study image. AI predicts realistic exam questions, creates structured notes, and drafts interactive recall quizzes.
        </p>
      </div>

      {/* File Upload Box */}
      <div className="w-full max-w-xl px-4 space-y-6">
        <FileUploader onFileSelected={handleFileSelected} disabled={loading} />

        {/* Selected File Feedback */}
        {file && (
          <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-left">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          </div>
        )}

        {/* Difficulty & Controls */}
        {file && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Difficulty:</span>
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    difficulty === d
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Exam
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs text-left font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Generated Quiz Results Preview */}
      {quizData && (
        <div className="w-full max-w-3xl p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-left space-y-4 shadow-xl">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Generated Overview</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{quizData.summary}</p>
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              Successfully generated {quizData.questions?.length || 0} predictive exam questions!
            </p>
          </div>
        </div>
      )}

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl w-full px-4 pt-6">
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">AI Notes & Summaries</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Clear summaries and structured bullet points with practical examples directly extracted from your text.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Predictive Questionnaires</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Forecasts realistic test questions divided into Easy, Medium, and Hard difficulty levels.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Hearts System</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Gamified learning stakes that keep you focused while testing your recall precision.
          </p>
        </div>
      </div>
    </div>
  );
}