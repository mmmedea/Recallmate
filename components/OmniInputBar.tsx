"use client";

import { useState, useRef } from "react";
import { Camera, FileText, Mic, Send, Youtube, Sparkles, X } from "lucide-react";

interface OmniInputBarProps {
  onSendMessage?: (message: string) => void;
  onFileSelect?: (file: File) => void;
  disabled?: boolean;
}

export default function OmniInputBar({
  onSendMessage,
  onFileSelect,
  disabled = false,
}: OmniInputBarProps) {
  const [text, setText] = useState("");
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;
    if (onSendMessage) onSendMessage(text.trim());
    setText("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    if (onSendMessage) {
      onSendMessage(`Process YouTube Video: ${youtubeUrl.trim()}`);
    }
    setYoutubeUrl("");
    setMediaModalOpen(false);
  };

  return (
    <>
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Sticky Omni-Input Bar (Fixed Footer) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-lg">
        <form
          onSubmit={handleSend}
          className="mx-auto max-w-2xl flex items-center gap-2"
        >
          {/* Quick Action Triggers */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              title="Camera Scan / OCR"
              disabled={disabled}
              className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Document (PDF / DOCX)"
              disabled={disabled}
              className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setMediaModalOpen(true)}
              title="YouTube & Audio Recording"
              disabled={disabled}
              className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <Youtube className="w-4 h-4" />
            </button>
          </div>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Omni-Assistant or type prompt..."
              disabled={disabled}
              className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm transition-colors"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || disabled}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold shadow-md transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Multimodal Media Modal */}
      {mediaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMediaModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  Multimodal Media Input
                </h3>
                <p className="text-xs text-slate-500">
                  YouTube Transcripts & Audio Processing
                </p>
              </div>
            </div>

            <form onSubmit={handleYoutubeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  YouTube Video URL
                </label>
                <div className="relative flex items-center">
                  <Youtube className="absolute left-3.5 w-4 h-4 text-rose-500" />
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!youtubeUrl.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all text-sm"
              >
                Extract Transcript & Study
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
