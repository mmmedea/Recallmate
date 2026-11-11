"use client";

// Make sure your imports (useState, icons, etc.) stay at the top
import { CloudUpload, FileText, Video } from "lucide-react";

export default function FileUploader() {
  // Your existing state logic goes here...

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-8">
      
      {/* 1. Page Headers - FIXED VISIBILITY */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          Upload your material
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          We'll extract the content and generate notes plus active recall questions.
        </p>
      </div>

      {/* 2. Upload Box - FIXED VISIBILITY & BACKGROUND */}
      <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-10 text-center transition-colors hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer">
        
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
          <CloudUpload className="w-8 h-8" />
        </div>

        {/* Box Heading */}
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Drop a file or click to upload
        </h3>
        
        {/* Box Subtext */}
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          PDF, DOCX, TXT, or video/audio for automatic transcription
        </p>

        {/* Small Badges */}
        <div className="flex justify-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><FileText className="w-4 h-4"/> Documents</span>
          <span className="flex items-center gap-1.5"><Video className="w-4 h-4"/> Video / Audio</span>
        </div>
      </div>

      {/* 3. Error Message - FIXED VISIBILITY */}
      {/* Assuming you have an 'error' state variable mapping to this */}
      <div className="text-rose-600 dark:text-rose-400 font-medium text-sm px-2">
        Failed to parse structured study content. {/* Replace with your dynamic {error} variable */}
      </div>

    </div>
  );
}