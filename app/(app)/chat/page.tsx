import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { documentId?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const documentId = searchParams.documentId;
  if (!documentId) {
    redirect("/dashboard");
  }

  // Fetch document details to verify access and get title
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, title")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (docError || !document) {
    redirect("/dashboard"); // Unauthorized or not found
  }

  // Resolve conversation
  let conversationId = null;
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("document_id", documentId)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  }

  let initialMessages: any[] = [];

  if (conversationId) {
    // Load persisted chat history
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at, chat_citations(id, label:alias, excerpt:source_chunk_id)") // Basic citation mapping for now
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
      
    if (messages) {
      initialMessages = messages.map(msg => {
        const annotations = [];
        
        // Reconstruct citations into annotations so ChatMessage renders them
        if (msg.chat_citations && msg.chat_citations.length > 0) {
          msg.chat_citations.forEach((cite: any) => {
            annotations.push({
              type: "data-citation",
              data: {
                citationId: cite.id,
                label: cite.label || "Document Reference",
                excerpt: cite.excerpt
              }
            });
          });
        }

        return {
          id: msg.id,
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
          annotations
        };
      });
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <ChatClient
        documentId={document.id}
        documentTitle={document.title}
        initialMessages={initialMessages}
      />
    </div>
  );
}
