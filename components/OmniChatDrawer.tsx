"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type UIMessage,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { createPortal } from "react-dom";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Paperclip,
  Crown,
  FileText,
  Youtube,
  Zap,
  Square,
} from "lucide-react";
import MathRenderer from "./MathRenderer";
import { useAppStore } from "@/lib/store";
import { processFileClientSide } from "@/lib/client-parser";
import { attachmentFirstContext } from '@/lib/ai/attachment-context';
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/constants";
import { MedeaLauncher } from '@/components/medea/MedeaLauncher';
import { DiamondLoader } from "@/components/DiamondLoader";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

type MedeaDocumentMetadata = {
  documentId: string;
  fileName: string;
  readiness:
    | "ready"
    | "processing"
    | "failed";
};

// Quiet file attachment: held as chip state, bundled into API only on send
interface AttachedFile {
  name: string;
  context: string;
}

export default function OmniChatDrawer() {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documentMetadata, setDocumentMetadata] =
    useState<MedeaDocumentMetadata | null>(null);
  const [documentMetadataLoading, setDocumentMetadataLoading] =
    useState(false);
  const [documentMetadataError, setDocumentMetadataError] =
    useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  // Attachment chip state — does NOT trigger AI until user sends a prompt
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const sourceHistoryStart = useRef(0);
  const handledMedeaRequestRef = useRef<number | null>(null);
  const documentMetadataRequestRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleId = useId();

  const { isPremium, activeChatContext, addChatContext, chatDrawerOpen: isOpen, setChatDrawerOpen: setIsOpen, medeaRequest } = useAppStore();
  const requestedDocumentId = medeaRequest?.documentId ?? null;
  const documentChatTransport =
    useMemo(
      () =>
        new DefaultChatTransport({
          api: "/api/chat",

          prepareSendMessagesRequest:
            ({ messages }) => {
              const latestUserMessage =
                [...messages]
                  .reverse()
                  .find(
                    (message) =>
                      message.role ===
                      "user",
                  );

              const message =
                latestUserMessage?.parts
                  .map((part) =>
                    part.type ===
                    "text"
                      ? part.text
                      : "",
                  )
                  .join("")
                  .trim() ?? "";

              return {
                body: {
                  documentId:
                    requestedDocumentId,

                  message,

                  requestId:
                    uuidv4(),
                },
              };
            },
        }),
      [
        requestedDocumentId,
      ],
    );
  const {
    sendMessage:
      sendDocumentMessage,
    messages:
      documentStreamMessages,
    setMessages:
      setDocumentStreamMessages,
  } = useChat<UIMessage>({
    transport:
      documentChatTransport,
  });
  const documentReady =
    !!requestedDocumentId &&
    documentMetadata?.documentId === requestedDocumentId &&
    documentMetadata.readiness === "ready";
  const documentPending =
    !!requestedDocumentId &&
    !documentReady;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I'm **Medea AI**, your unified learning assistant. Ask me a simple or complex question about any subject, or attach study material—I’ll answer directly and explain the reasoning clearly.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const initialMessagesRef =
    useRef(messages);
  const previousDocumentIdRef =
    useRef<string | null>(
      requestedDocumentId,
    );

  useEffect(() => {
    const latestAssistantMessage =
      [...documentStreamMessages]
        .reverse()
        .find(
          (message) =>
            message.role ===
            "assistant",
        );

    if (!latestAssistantMessage) {
      return;
    }

    const content =
      latestAssistantMessage.parts
        .map((part) =>
          part.type === "text"
            ? part.text
            : "",
        )
        .join("");

    if (!content) {
      return;
    }

    /*
     * Use the SDK message id as the stable bridge
     * between streaming updates and the drawer's
     * local message list.
     *
     * text-delta events update the same visible
     * assistant message instead of creating one
     * message per chunk.
     */
    const localMessageId =
      `document-stream:${latestAssistantMessage.id}`;

    setMessages((previous) => {
      const existingIndex =
        previous.findIndex(
          (message) =>
            message.id ===
            localMessageId,
        );

      if (existingIndex === -1) {
        return [
          ...previous,
          {
            id:
              localMessageId,
            role:
              "assistant",
            content,
            timestamp:
              new Date().toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ),
          },
        ];
      }

      const existingMessage =
        previous[
          existingIndex
        ];

      if (
        existingMessage.content ===
        content
      ) {
        return previous;
      }

      return previous.map(
        (
          message,
          index,
        ) =>
          index ===
          existingIndex
            ? {
                ...message,
                content,
              }
            : message,
      );
    });
  }, [
    documentStreamMessages,
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

  useEffect(() => {
    const previousDocumentId =
      previousDocumentIdRef.current;

    /*
     * Once a visible conversation belongs to a saved
     * document, leaving that document invalidates the
     * conversation immediately.
     *
     * Covers:
     *   document A → document B
     *   document A → general Medea
     *
     * Does not reset:
     *   same document → same document/new nonce
     *   general Medea → document
     */
    const leftPreviousDocument =
      !!previousDocumentId &&
      previousDocumentId !==
        requestedDocumentId;

    if (leftPreviousDocument) {
      /*
       * Clear both visible drawer state and the AI SDK
       * conversation state. Otherwise a later send in
       * the new document can cause an assistant message
       * from the previous document to be mirrored back
       * into the visible conversation.
       */
      setMessages(
        initialMessagesRef.current,
      );

      setDocumentStreamMessages([]);
    }

    previousDocumentIdRef.current =
      requestedDocumentId;
  }, [
    requestedDocumentId,
    setDocumentStreamMessages,
  ]);

  useEffect(() => {
    if (!mounted || !isOpen) return;
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      if (launcher?.isConnected) launcher.focus();
    };
  }, [mounted, isOpen]);

  useEffect(() => {
    if (!medeaRequest || handledMedeaRequestRef.current === medeaRequest.nonce) return;
    handledMedeaRequestRef.current = medeaRequest.nonce;
    // Task 1 is a context handoff only. Prefilling never sends a message or
    // pretends that a client-provided document ID has been authorized/loaded.
    setInput(medeaRequest.suggestedPrompt || '');
    // Capture the original launcher above before focusing a new request.
    // Switching to general chat removes its action button from the dialog.
    dialogRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [medeaRequest]);

  useEffect(() => {
    /*
     * Every document-source transition invalidates
     * all earlier metadata work, including a switch
     * back to general Medea.
     */
    const requestVersion =
      ++documentMetadataRequestRef.current;

    if (!requestedDocumentId) {
      setDocumentMetadata(null);
      setDocumentMetadataLoading(false);
      setDocumentMetadataError(null);
      return;
    }

    const controller =
      new AbortController();

    setDocumentMetadata(null);
    setDocumentMetadataLoading(true);
    setDocumentMetadataError(null);

    const isCurrentRequest =
      () =>
        !controller.signal.aborted &&
        documentMetadataRequestRef.current ===
          requestVersion;

    void (async () => {
      try {
        const response = await fetch(
          `/api/chat?documentId=${encodeURIComponent(requestedDocumentId)}`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        /*
         * fetch implementations are not required to
         * honor AbortController. The request token is
         * the final authority for whether results commit.
         */
        if (!isCurrentRequest()) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            "DOCUMENT_METADATA_UNAVAILABLE",
          );
        }

        const metadata =
          (await response.json()) as MedeaDocumentMetadata;

        if (!isCurrentRequest()) {
          return;
        }

        /*
         * Do not accept metadata that claims to
         * describe a different document.
         */
        if (
          metadata.documentId !==
          requestedDocumentId
        ) {
          throw new Error(
            "DOCUMENT_METADATA_MISMATCH",
          );
        }

        setDocumentMetadata(metadata);
      } catch {
        /* An aborted or superseded request is not an active-source error. */
        if (!isCurrentRequest()) {
          return;
        }

        setDocumentMetadata(null);
        setDocumentMetadataError(
          "Document unavailable",
        );
      } finally {
        if (isCurrentRequest()) {
          setDocumentMetadataLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [requestedDocumentId]);

  if (!mounted || typeof document === "undefined") return null;

  const hasUploadedMaterial =
    activeChatContext.length > 0 ||
    attachedFiles.length > 0 ||
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

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], textarea:not(:disabled), input:not(:disabled):not([type="file"]):not([type="hidden"]), select:not(:disabled), [tabindex="0"]',
    )).filter(element => !element.hidden && getComputedStyle(element).display !== 'none');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || input).trim();
    if (!textToSend || loading || uploading || attachmentError || documentPending) return;

    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };



    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      /*
       * Saved documents use the same AI SDK stream
       * transport as ChatClient.
       */
      if (
        requestedDocumentId &&
        documentReady
      ) {
        await sendDocumentMessage({
          text: textToSend,
        });

        return;
      }

      // Attachments remain pinned and visible until removed. Never substitute
      // generated Notes, a previous quiz, or ambient sessionStorage for a file.
      const docContext = attachmentFirstContext(attachedFiles, activeChatContext, textToSend);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          documentContext: docContext,
          sourceScopedHistory: attachedFiles.length > 0,
          messages: [...messages.slice(sourceHistoryStart.current), userMsg].slice(-24).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const raw = await res.text();
      let data: { content?: string; error?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { data = { error: res.ok ? "Medea returned an unreadable response." : `Medea is temporarily unavailable (${res.status}).` }; }

      if (!res.ok) {
        throw new Error(data.error || "Failed to reach Medea.");
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || "Medea returned an empty response. Please try again.",
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Reset input so the same files can be re-selected if needed
    e.target.value = "";

    if (attachedFiles.length + files.length > 5) {
      alert("You can only upload up to 5 files at a time.");
      return;
    }

    setUploading(true);
    setAttachmentError('');
    setAttachedFiles([]);
    sourceHistoryStart.current = messages.length;

    for (const file of files) {
      try {
        const extractedText = await processFileClientSide(file);

        // Save as quiet chip — no chat message, no API call yet
        setAttachedFiles((prev) => [...prev, { name: file.name, context: extractedText }]);
      } catch (err: any) {
        setAttachmentError(`Could not read ${file.name}. Retry the upload or remove the failed attachment.`);
      }
    }

    setUploading(false);
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
      <MedeaLauncher
        source="mobile-fab"
        aria-label="Open Medea AI"
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[999] flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group border border-white/20"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-indigo-700" />
        </div>
        <span className="text-sm tracking-wide">Medea AI</span>
      </MedeaLauncher>

      {/* Slide-Over Drawer Overlay */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 h-[100dvh] z-[9999] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onKeyDown={handleDialogKeyDown}
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
                  <h2 id={dialogTitleId} className="font-black text-slate-900 dark:text-white text-base flex items-center gap-1.5">
                    Medea AI
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
                    One assistant for every subject
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close Medea AI"
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {requestedDocumentId && (
              <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <div className="font-semibold">
                  {documentMetadataLoading ? (
                    <div className="inline-flex items-center gap-2"><DiamondLoader variant="inline" label="Loading document" />Loading document…</div>
                  ) : documentReady && documentMetadata ? (
                    <>Using: {documentMetadata.fileName}</>
                  ) : documentMetadataError ? (
                    <>Document selected — unavailable</>
                  ) : (
                    <>Document selected — not loaded</>
                  )}
                </div>
                <p className="mt-1 text-xs">
                  {documentMetadataLoading
                    ? "Checking whether this saved document is ready."
                    : documentReady
                      ? "Medea will use this saved document as the source."
                      : "Medea will not answer from this document until it can read it securely."}
                </p>
                <MedeaLauncher source="legacy" className="mt-2 text-xs font-semibold underline">Open general Medea instead</MedeaLauncher>
              </div>
            )}
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
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <DiamondLoader variant="inline" label={uploading ? "Processing file" : "Generating answer"} />
                    {uploading ? "Processing file…" : "Generating answer…"}
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
                      disabled={loading || uploading || documentPending}
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

            {attachmentError && <div role="alert" className="p-3 text-sm text-rose-600">{attachmentError}<button type="button" className="ml-2 underline" onClick={() => setAttachmentError('')}>Remove failed attachment</button></div>}
            {/* Active sources stay visible through follow-up turns. */}
            {attachedFiles.length > 0 && (
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 border-t border-indigo-100 dark:border-indigo-900/40 flex flex-col gap-2 animate-in fade-in duration-200">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate flex-1">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">Using these sources for this conversation</span>
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
                multiple
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt,.md,image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading}
                title={`Upload PDF, DOCX, image, or text file (${MAX_DOCUMENT_UPLOAD_MB}MB limit)`}
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
                aria-label="Ask Medea a question"
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
                  aria-label="Send question to Medea"
                  disabled={!input.trim() || uploading || !!attachmentError || documentPending}
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
