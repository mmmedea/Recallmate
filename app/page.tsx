"use client";

import { useState } from "react";
import { Upload, Sparkles, Brain, Heart, FileText, ArrowRight } from "lucide-react";

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Process file or trigger navigation/upload logic here
      console.log("File selected:", file.name);
    }
  };

  return (
    <div className="relative min-h-[85vh] flex flex-col justify-center items-center text-center space-y-10 py-10 transition-colors duration-300">
      {/* Soft Background Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/50 backdrop-blur-md shadow-sm">
        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-bold tracking-wide text-indigo-700 dark:text-indigo-300 uppercase">
          Predictive Exam AI + Active Recall
        </span>
      </div>

      {/* Main Heading & Subtitle */}
      <div className="max-w-3xl space-y-5 px-4">
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

      {/* File Upload Dropzone UI Box */}
      <div className="w-full max-w-xl px-4">
        <label 
          htmlFor="file-upload" 
          className="group relative cursor-pointer flex flex-col items-center justify-center p-8 sm:p-10 border-2 border-dashed border-indigo-300 dark:border-indigo-900/80 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl transition-all duration-200 shadow-lg hover:shadow-indigo-500/10"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-4">
            <Upload className="w-7 h-7" />
          </div>

          <div className="space-y-1 mb-2">
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              {selectedFile ? selectedFile.name : "Click or drag & drop your study file"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supports PDF, PPT, PPTX, DOCX, PNG, or JPEG
            </p>
          </div>

          <div className="inline-flex items-center gap-2 mt-3 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md">
            <span>{selectedFile ? "Change File" : "Select Document"}</span>
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Hidden File Input Element */}
          <input 
            type="file" 
            accept=".pdf,.ppt,.pptx,.doc,.docx,image/png,image/jpeg,image/jpg" 
            className="hidden" 
            id="file-upload" 
            onChange={handleFileChange} 
          />
        </label>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl w-full px-4 pt-6">
        {/* Card 1 */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            AI Notes & Summaries
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Clear summaries and structured bullet points with practical examples directly extracted from your text.
          </p>
        </div>

        {/* Card 2 */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Predictive Questionnaires
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Forecasts realistic test questions divided into Easy, Medium, and Hard difficulty levels.
          </p>
        </div>

        {/* Card 3 */}
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-lg shadow-sm hover:shadow-md transition-all text-left space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Hearts System
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Gamified learning stakes that keep you focused while testing your recall precision.
          </p>
        </div>
      </div>
    </div>
  );
}