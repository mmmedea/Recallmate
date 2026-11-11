"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatMessage } from "@/components/chat/ChatMessage";

export default function ChatClient({
  documentId,
  documentTitle,
  initialMessages,
}: {
  documentId: string;
  documentTitle: string;
  initialMessages: any[];
}) {
  const [input, setInput] = useState("");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const {
    messages,
    sendMessage,
    status,
    error,
    regenerate,
    stop,
  } = useChat({
    transport,
    messages: initialMessages,
    onError: (err) => {
      console.error("Chat Error:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const sendText = (rawText: string) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    const nextRequestId = uuidv4();
    void sendMessage(
      { text },
      { body: { documentId, message: text, requestId: nextRequestId } }
    );
    setInput("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendText(input);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const handleSuggestedPrompt = (prompt: string) => sendText(prompt);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const lastMessage = messages[messages.length - 1] as any;
  const annotations = lastMessage?.metadata?.annotations || lastMessage?.annotations || [];
  let srStatus = "";
  if (isLoading && lastMessage?.role === "assistant" && Array.isArray(annotations)) {
    const statuses = annotations.filter((annotation: any) => annotation.type === "data-tutor-status");
    if (statuses.length > 0) {
      srStatus = statuses[statuses.length - 1].data?.label || "";
    }
  } else if (!isLoading && lastMessage?.role === "assistant") {
    srStatus = "Answer ready.";
  }

  const lastUserMessage = [...messages].reverse().find((message: any) => message.role === "user") as any;
  const lastUserText = lastUserMessage?.parts
    ?.filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("") || "";

  const handleRetry = () => {
    if (!lastUserText) return;
    const nextRequestId = uuidv4();
    void regenerate({
      body: { documentId, message: lastUserText, requestId: nextRequestId },
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-zinc-50 dark:bg-zinc-950 relative">
      <ChatHeader documentTitle={documentTitle} />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srStatus}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-8 pb-10">
          {messages.map((message: any, index: number) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isLast={index === messages.length - 1}
              isLoading={isLoading && index === messages.length - 1}
            />
          ))}
          {error && (
            <div className="flex flex-col gap-2 items-center text-red-500 my-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
              <span className="text-sm">⚠ I couldn't complete that response.</span>
              <button
                onClick={handleRetry}
                className="min-h-[44px] px-4 py-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Try again
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="shrink-0 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent dark:from-zinc-950 dark:via-zinc-950 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 pt-2">
          <ChatComposer
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            onSendPrompt={handleSuggestedPrompt}
            isLoading={isLoading}
            stop={stop}
          />
        </div>
      </div>
    </div>
  );
}
