import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Database } from "@/types/supabase";
import { LexicalRetriever } from "@/lib/ai/retriever";
import { BillingService } from "@/lib/ai/billing";
import { ProviderAdapter } from "@/lib/ai/provider";
import { buildBoundedMemoryPrompt, ChatMessage } from "@/lib/ai/memory";
import { rateLimitAdapter } from "@/lib/ai/ratelimit";
import { createUIMessageStreamResponse } from "ai";
import {
  buildMedeaGeneralPrompt,
  MEDEA_GENERAL_SYSTEM_PROMPT,
  parseMedeaChatRequest,
} from "@/lib/ai/chat-request";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const token = req.headers.get("authorization")?.split("Bearer ")[1];
  const { data: { user }, error: authError } = token 
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await rateLimitAdapter.checkChatRateLimit(user.id);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let chatRequest;
  try {
    chatRequest = parseMedeaChatRequest(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: error instanceof z.ZodError ? error.issues : undefined,
      },
      { status: 400 }
    );
  }

  if (chatRequest.kind === "general") {
    try {
      const response = await ProviderAdapter.generate({
        operation: "chat",
        systemInstruction: MEDEA_GENERAL_SYSTEM_PROMPT,
        prompt: buildMedeaGeneralPrompt(chatRequest),
      });
      return NextResponse.json({ content: response.text });
    } catch (error) {
      console.error("Medea general chat error:", error);
      return NextResponse.json(
        { error: "Medea couldn't generate an answer right now. Please try again." },
        { status: 500 }
      );
    }
  }

  const { documentId, message, requestId } = chatRequest;

  const serviceClient = createServiceClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Authorization: verify user owns this document
  const { data: document, error: docError } = await serviceClient
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 403 });
  }

  // 2. Resolve Conversation (Immutable Document Scope)
  let conversationId: string;
  const { data: existingConv } = await serviceClient
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("document_id", documentId)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: newConvError } = await serviceClient
      .from("conversations")
      .insert({ user_id: user.id, document_id: documentId })
      .select("id")
      .single();
    
    if (newConvError || !newConv) {
      return NextResponse.json({ error: "Failed to create conversation context" }, { status: 500 });
    }
    conversationId = newConv.id;
  }

  // 3. Idempotency Check via chat_interactions
  const { data: existingInteraction } = await serviceClient
    .from("chat_interactions")
    .select("*")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingInteraction) {
    if (existingInteraction.status === 'completed') {
      // Re-stream the recovered response
      return createUIMessageStreamResponse({
        execute: async (dataStream) => {
          const { data: reply } = await serviceClient
            .from("chat_messages")
            .select("content, id")
            .eq("interaction_id", existingInteraction.id)
            .eq("role", "assistant")
            .single();

          const { data: citations } = await serviceClient
            .from("chat_citations")
            .select("source_chunk_id, alias")
            .eq("interaction_id", existingInteraction.id);

          dataStream.writeData({ recovered: true });
          if (citations) {
             dataStream.writeMessageAnnotation({ type: 'citations', data: citations });
          }
          dataStream.writeText(reply?.content || "");
        }
      });
    } else if (existingInteraction.status === 'generating') {
      return NextResponse.json({ error: "Request is currently generating" }, { status: 409 });
    } else {
      return NextResponse.json({ error: `Previous request failed with status: ${existingInteraction.status}. Use a new requestId to retry.` }, { status: 400 });
    }
  }

  // 4. Create AI Job (Billing Entity)
  const billingJobId = crypto.randomUUID();
  await serviceClient.from("ai_jobs").insert({
    id: billingJobId,
    user_id: user.id,
    document_id: documentId,
    operation: "chat",
    idempotency_key: requestId,
    execution_mode: "synchronous",
    status: "processing",
    started_at: new Date().toISOString()
  });

  const billingService = new BillingService(serviceClient);
  try {
    await billingService.reserveCredits(user.id, billingJobId, 5, "Reserve: chat turn");
  } catch (e: any) {
    await serviceClient.from("ai_jobs").update({ status: "failed" }).eq("id", billingJobId);
    return NextResponse.json({ error: e.message || "Insufficient credits" }, { status: 402 });
  }

  // 5. Create Chat Interaction
  const { data: interaction, error: interactionError } = await serviceClient
    .from("chat_interactions")
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      request_id: requestId,
      status: "generating",
      billing_job_id: billingJobId
    })
    .select("id")
    .single();

  if (interactionError || !interaction) {
    await serviceClient.from("ai_jobs").update({ status: "failed" }).eq("id", billingJobId);
    await billingService.finalizeJob(user.id, billingJobId, 0, "Interaction init failed");
    return NextResponse.json({ error: "Failed to initialize interaction" }, { status: 500 });
  }

  const interactionId = interaction.id;

  // 6. Save User Message
  await serviceClient.from("chat_messages").insert({
    interaction_id: interactionId,
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: message
  });

  return createUIMessageStreamResponse({
    execute: async (dataStream) => {
      try {
        dataStream.writeMessageAnnotation({ type: 'data-tutor-status', data: { label: 'Retrieving context...' } });

        // 7. Context Retrieval
        const retriever = new LexicalRetriever(serviceClient);
        const retrievedContext = await retriever.retrieveRelevantChunks({
          documentId,
          userId: user.id,
          query: message,
          limit: 10,
          maxTokens: 8000
        });

        // 8. Bounded Memory
        const { data: historyData } = await serviceClient
          .from("chat_messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .neq("interaction_id", interactionId)
          .order("created_at", { ascending: false })
          .limit(10);
        
        const history: ChatMessage[] = (historyData || []).reverse().map((h: any) => ({
          role: h.role as ChatMessageRole,
          content: h.content
        }));

        const systemPrompt = "You are a helpful study assistant. Answer questions strictly based on the provided RETRIEVED DOCUMENT CONTEXT. If the answer cannot be found in the context, explicitly state 'I couldn't find that information in your document.' Always provide citations using chunkIndex.";
        
        const prompt = buildBoundedMemoryPrompt({
          systemPrompt,
          question: message,
          retrievedContext: retrievedContext.chunks,
          history,
          maxHistoryMessages: 10
        });

        dataStream.writeMessageAnnotation({ type: 'data-tutor-status', data: { label: 'Generating answer...' } });

        // 9. Generate & Stream Text natively
        const stream = await ProviderAdapter.stream({
           operation: "chat",
           prompt,
           systemInstruction: systemPrompt
        });

        let fullContent = "";
        for await (const chunk of stream) {
           // Handle Google GenAI chunk structure
           const textChunk = chunk.text || "";
           if (textChunk) {
              dataStream.writeText(textChunk);
              fullContent += textChunk;
           }
        }

        // 10. Persist completion
        const { data: assistantMsg } = await serviceClient.from("chat_messages").insert({
          interaction_id: interactionId,
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: fullContent
        }).select("id").single();

        // Very basic citation extraction (since we moved away from structured output for streaming)
        // You could adapt a citation regex here if needed, but for now we complete the interaction
        
        await serviceClient.from("chat_interactions").update({
          status: "completed",
          completed_at: new Date().toISOString()
        }).eq("id", interactionId);

        await billingService.finalizeJob(user.id, billingJobId, 5, "Chat completed successfully");
      } catch (err: any) {
        console.error("Stream Execution Error:", err);
        await serviceClient.from("chat_interactions").update({
          status: "failed",
          error_message: err.message
        }).eq("id", interactionId);
        
        await serviceClient.from("ai_jobs").update({ status: "failed" }).eq("id", billingJobId);
        await billingService.finalizeJob(user.id, billingJobId, 0, "AI generation failed");
        
        throw err;
      }
    }
  });
}
