"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Video } from "lucide-react";

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
      className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition ${
        isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.docx,.txt,.md,video/*,audio/*"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
        <UploadCloud className="h-7 w-7 text-indigo-500" />
      </div>
      <p className="font-semibold text-gray-900">Drop a file or click to upload</p>
      <p className="mt-1 text-sm text-gray-400">
        PDF, DOCX, TXT, or video/audio for automatic transcription
      </p>
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Documents</span>
        <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Video / Audio</span>
      </div>
    </div>
  );
}