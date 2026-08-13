"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, BrainCircuit } from "lucide-react";
import ProgressiveNote from "@/components/ProgressiveNote";
import MathRenderer from "@/components/MathRenderer";

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
    <div className="mx-auto max-w-3xl py-10 px-4 space-y-8 pb-32 transition-colors duration-200">
      
      {/* Top Navigation */}
      <div className="flex justify-between items-center">
        <button 
          onClick={() => router.push("/upload")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Upload
        </button>
        
        <button
          onClick={() => {
            sessionStorage.setItem("recallmate-reconfigure", "true");
            router.push("/upload");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98]"
        >
          <BrainCircuit className="w-4 h-4" /> Switch to Quiz Mode
        </button>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          {content.fileName}
        </h1>
        <MathRenderer
          content={content.summary}
          className="text-base text-slate-600 dark:text-slate-400 leading-relaxed"
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-6 h-6" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              AI Study Notes & Concepts
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Progressive Accordions
          </span>
        </div>

        <div className="space-y-4">
          {content.notes?.map((note: string, idx: number) => {
            // Extract potential title or use default heading
            const parts = note.split(":");
            const title = parts.length > 1 ? parts[0] : `Concept Note ${idx + 1}`;
            const body = parts.length > 1 ? parts.slice(1).join(":").trim() : note;

            return (
              <ProgressiveNote
                key={idx}
                index={idx}
                title={title}
                content={body}
                difficulty={idx % 4 === 3 ? "hard" : "easy"}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}