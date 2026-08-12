"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  BookOpen,
  Brain,
  RefreshCw,
  Paperclip,
  Crown,
  FileText,
  Youtube,
  Zap,
  HelpCircle,
  CheckCircle2,
  Square,
} from "lucide-react";
import MathRenderer from "./MathRenderer";
import { useAppStore } from "@/lib/store";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Quiet file attachment: held as chip state, bundled into API only on send
interface AttachedFile {
  name: string;
  context: string;
}

export default function OmniChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"tutor" | "dictionary" | "socratic">("tutor");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  // Attachment chip state — does NOT trigger AI until user sends a prompt
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  const { isPremium, activeChatContext, addChatContext } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I'm **Medea**! I'm your Assistant AI Tutor. Ask me anything about your uploaded study notes, technical definitions, or concepts!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!mounted || typeof document === "undefined") return null;

  const hasUploadedMaterial =
    activeChatContext.length > 0 ||
    attachedFile !== null ||
    (typeof window !== "undefined" && Boolean(sessionStorage.getItem("recallmate-content")));

  const getRecommendationPills = () => {
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistantMsg && lastAssistantMsg.content.includes("Recommended Next Questions")) {
      const lines = lastAssistantMsg.content.split("\n");
      const recIdx = lines.findIndex((l) => l.includes("Recommended Next Questions"));
      if (recIdx !== -1) {
        const questions: { text: string; level: string }[] = [];
        for (let i = recIdx + 1; i < lines.length; i++) {
          const cleanLine = lines[i].replace(/^[-*\d.\s]+/, "").trim();
          if (cleanLine && !cleanLine.startsWith("#")) {
            questions.push({ text: cleanLine, level: i % 2 === 0 ? "Medium" : "Easy" });
          }
        }
        if (questions.length > 0) return questions.slice(0, 4);
      }
    }
    return [
      { text: "Explain like I'm 5", level: "Easy" },
      { text: "Give me a real-world example", level: "Easy" },
      { text: "Give me a practice problem", level: "Medium" },
      { text: "Predictive AI Exam", level: "Medium" },
      { text: "Mastery Challenge", level: "Hard" },
    ];
  };

  const handlePauseStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;

    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Check if the message itself is a YouTube link — if so, bypass the upload guard
    // because the link IS the material. The backend's extractYouTubeId handles all formats.
    const ytPattern = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))[a-zA-Z0-9_-]{11}/;
    const isYouTubeMessage = ytPattern.test(textToSend);

    // Guard: Require uploaded material before querying AI engine
    // Bypassed when: material already uploaded, attachment chip present, or message is a YouTube link
    if (!hasUploadedMaterial && !isYouTubeMessage) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "⚠️ Please upload a study document or YouTube video first using the 📎 or 🎥 button below so I can analyze it for you!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Capture and clear attachment chip BEFORE the async call
    const pendingAttachment = attachedFile;
    setAttachedFile(null);

    try {
      // Build context string: priority: attachedFile chip → activeChatContext → sessionStorage
      let docContext = "";
      if (pendingAttachment) {
        // Attachment chip was held quietly — now bundle it into this single request
        docContext = `[DOCUMENT: ${pendingAttachment.name}]\n${pendingAttachment.context.slice(0, 6000)}`;
        // Also persist it to Zustand so future messages can access it
        addChatContext({
          source_type: "document",
          source_name: pendingAttachment.name,
          extracted_text: pendingAttachment.context,
        });
      } else if (activeChatContext.length > 0) {
        docContext = activeChatContext
          .map((ctx) => `[${ctx.source_type.toUpperCase()}: ${ctx.source_name}]\n${ctx.extracted_text.slice(0, 4000)}`)
          .join("\n\n");
      } else {
        const raw = sessionStorage.getItem("recallmate-content");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            docContext = `File: ${parsed.fileName || ""}\nSummary: ${parsed.summary || ""}\nNotes: ${
              Array.isArray(parsed.notes) ? parsed.notes.join("; ") : ""
            }`;
          } catch (e) {}
        }
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          documentContext: docContext,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reach Medea.");
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream generation paused by user.");
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `⚠️ ${err.message || "Something went wrong. Please check your connection."}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Quiet file attachment handler.
   * Parses the file server-side but does NOT post any chat message or trigger AI.
   * The extracted text is held in attachedFile state and displayed as a removable chip
   * above the input bar. It is only sent to the API when the student hits Send.
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse document.");

      // Save as quiet chip — no chat message, no API call yet
      setAttachedFile({ name: file.name, context: data.text });
    } catch (err: any) {
      alert(`File upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlToProcess = youtubeUrl.trim();
    if (!urlToProcess) return;

    setUploading(true);
    setYoutubeOpen(false);
    const capturedUrl = urlToProcess;
    setYoutubeUrl("");

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: capturedUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transcribe video.");

      addChatContext({
        source_type: "youtube_link",
        source_name: "YouTube Lecture Video",
        extracted_text: data.transcript,
      });

      // ✅ No passive placeholder — immediately trigger Medea to generate
      // the full summary, takeaways, analogy, and recommended questions
      // as a single seamless response, just as if the student sent the link.
      setUploading(false);
      await handleSend(undefined, capturedUrl);
    } catch (err: any) {
      alert(`YouTube transcription failed: ${err.message}`);
      setUploading(false);
    }
  };

  const drawerContent = (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Medea AI Chatbot"
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[999] flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group border border-white/20"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-indigo-700" />
        </div>
        <span className="text-sm tracking-wide">Medea AI</span>
      </button>

      {/* Slide-Over Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 h-[100dvh] z-[9999] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:w-[450px] md:w-[500px] h-[100dvh] max-h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-1.5">
                    Medea – AI Tutor
                    {isPremium ? (
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center gap-1">
                        <Crown className="w-3 h-3 fill-slate-950" /> Unlimited
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 rounded-full">
                        Online
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Interactive Tutor & Smart Dictionary
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Context Provenance Bar */}
            {activeChatContext.length > 0 && (
              <div className="px-4 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2 overflow-x-auto text-[11px]">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Material:
                </span>
                {activeChatContext.map((item) => (
                  <span
                    key={item.id}
                    className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 font-semibold truncate max-w-[140px]"
                  >
                    {item.source_name}
                  </span>
                ))}
              </div>
            )}

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl p-4 space-y-1 shadow-sm text-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200/50 dark:border-slate-700/50"
                    }`}
                  >
                    <MathRenderer content={msg.content} />
                    <span
                      className={`block text-[10px] text-right mt-1 ${
                        msg.role === "user" ? "text-indigo-200" : "text-slate-400"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {(loading || uploading) && (
                <div className="flex gap-3 justify-start animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {uploading ? "Ingesting document & extracting text..." : "Medea is synthesizing an easy-to-understand response..."}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Recommendation Chips (Only visible after material is uploaded) */}
            {hasUploadedMaterial && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" /> Recommended Action Prompts
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                  {getRecommendationPills().map((item, idx) => (
                    <button
                      key={idx}
                      disabled={loading || uploading}
                      onClick={() => {
                        handleSend(undefined, item.text);
                      }}
                      className={`px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-300 font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                        loading || uploading ? "opacity-50 pointer-events-none cursor-not-allowed" : ""
                      }`}
                    >
                      <span>{item.text}</span>
                      <span className="text-[9px] px-1 py-0.2 bg-indigo-200/50 dark:bg-indigo-800/50 rounded font-bold uppercase">
                        {item.level}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attachment Chip — shown when a file is quietly held, before user sends */}
            {attachedFile && (
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2 animate-in fade-in duration-200">
                <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate flex-1">
                  {attachedFile.name}
                </span>
                <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">Ready — type your question &amp; send</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="p-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* In-Chat Form + File Attachment Button + Pause Button */}
            <form
              onSubmit={(e) => handleSend(e)}
              className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 items-center"
            >
              {/* File Upload Trigger */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt,.md,image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading}
                title="Upload PDF, DOCX, image, or text file (50MB limit)"
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* YouTube Modal Trigger */}
              <button
                type="button"
                onClick={() => setYoutubeOpen(true)}
                disabled={loading || uploading}
                title="Paste YouTube link to ingest lecture audio transcript"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Youtube className="w-4 h-4" />
              </button>

              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={loading ? "Medea is writing..." : "Ask Medea a question..."}
                disabled={loading || uploading}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed resize-none overflow-y-auto"
                style={{ maxHeight: '150px' }}
              />

              {loading ? (
                <button
                  type="button"
                  onClick={handlePauseStream}
                  title="Pause / Stop generation"
                  className="px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-all flex items-center justify-center gap-1.5 animate-pulse"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-white" />
                  <span className="text-xs">Pause</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || uploading}
                  className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold shadow-md transition-all flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* YouTube URL Modal */}
      {youtubeOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Youtube className="w-5 h-5 text-rose-500" /> Ingest YouTube Lecture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste a YouTube video URL to automatically extract its transcript and sync into Medea's study context.
            </p>
            <form onSubmit={handleYoutubeSubmit} className="space-y-3">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setYoutubeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Summarize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(drawerContent, document.body);
}
