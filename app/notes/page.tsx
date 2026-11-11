"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, BrainCircuit } from "lucide-react";

export default function NotesPage() {
  const [content, setContent] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("recallmate-content");
    if (!raw) {
      router.push("/upload");
      return;
    }
    setContent(JSON.parse(raw));
  }, [router]);

  if (!content) return null;

  return (
    <div className="mx-auto max-w-3xl py-12 px-4 space-y-8 transition-colors duration-200">
      
      {/* Top Navigation with Return Arrow */}
      <div className="flex justify-between items-center">
        <button 
          onClick={() => router.push("/upload")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Upload
        </button>
        
        <button
          onClick={() => {
            // Signals the upload page to open straight to the configuration options for a new quiz
            sessionStorage.setItem("recallmate-reconfigure", "true");
            router.push("/upload");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all"
        >
          <BrainCircuit className="w-4 h-4" /> Switch to Quiz Mode
        </button>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          {content.fileName}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {content.summary}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-4">
          <BookOpen className="w-6 h-6" />
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Detailed Study Notes & Examples</h2>
        </div>

        <ul className="space-y-4">
          {content.notes?.map((note: string, idx: number) => (
            <li 
              key={idx} 
              className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex gap-4 text-slate-700 dark:text-slate-300"
            >
              <span className="flex-shrink-0 w-7 h-7 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold text-sm">
                {idx + 1}
              </span>
              <span className="leading-relaxed font-medium mt-0.5">{note}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}