"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Image as ImageIcon } from "lucide-react";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/constants";

export default function FileUploader({
  onFileSelected,
  disabled
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFileSelected(files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
        isDragging
          ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40"
          : "border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.ppt,.pptx,.doc,.docx,image/png,image/jpeg,image/jpg"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
        <UploadCloud className="h-7 w-7" />
      </div>

      <p className="text-base font-bold text-slate-900 dark:text-white">
        Drop a file or click to upload
      </p>
      
      <p className="text-sm text-gray-500">
        Supports PDF, PPT, PPTX, DOCX, PNG, and JPEG up to {MAX_DOCUMENT_UPLOAD_MB}MB
      </p>

      <div className="mt-5 flex items-center gap-6 text-xs font-semibold text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-indigo-500" /> Documents
        </span>
        <span className="flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-purple-500" /> Images
        </span>
      </div>
    </div>
  );
}
