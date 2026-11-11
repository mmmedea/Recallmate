"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useRef, useEffect } from "react";
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
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  
  const {
    messages,
    sendMessage,
    status,
    error,
    regenerate,
    stop,
  } = useChat<UIMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages }) {
        const latestUserMessage = [...messages].reverse().find(
          (message) => message.role === "user"
        );
        const latestText =
          latestUserMessage?.parts
            ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
            .map((part) => part.text)
            .join("\n")
            .trim() || input.trim();

        return {
          body: {
            documentId,
            message: latestText,
            requestId: uuidv4(),
          },
        };
      },
    }),
    onError: (err) => {
      console.error("Chat Error:", err);
    }
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract the latest status for screen readers
  const lastMessage = messages[messages.length - 1];
  let srStatus = "";
  const lastAnnotations = ((lastMessage as any)?.annotations || (lastMessage as any)?.parts || []) as any[];
  if (isLoading && lastMessage?.role === "assistant" && lastAnnotations.length > 0) {
    const statuses = lastAnnotations.filter((a: any) => a.type === "data-tutor-status");
    if (statuses.length > 0) {
      srStatus = statuses[statuses.length - 1].data?.label || "";
    }
  } else if (!isLoading && lastMessage?.role === "assistant") {
    srStatus = "Answer ready.";
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-zinc-50 dark:bg-zinc-950 relative">
      <ChatHeader documentTitle={documentTitle} />
      
      {/* Global polite aria-live region for status changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srStatus}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-8 pb-10">
          {messages.map((message, index) => (
            <ChatMessage 
               key={message.id || index} 
               message={message} 
               isLast={index === messages.length - 1} 
               isLoading={isLoading && index === messages.length - 1}
               streamData={[]} 
            />
          ))}
          {error && (
            <div className="flex flex-col gap-2 items-center text-red-500 my-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
              <span className="text-sm">⚠ I couldn't complete that response.</span>
              <button 
                onClick={() => regenerate()} 
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
             isLoading={isLoading}
             stop={stop}
          />
        </div>
      </div>
    </div>
  );
}
