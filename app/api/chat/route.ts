import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { Database } from "@/types/supabase";
import { LexicalRetriever } from "@/lib/ai/retriever";
import { BillingService } from "@/lib/ai/billing";
import { ProviderAdapter } from "@/lib/ai/provider";
import { buildBoundedMemoryPrompt, ChatMessage } from "@/lib/ai/memory";
import { rateLimitAdapter } from "@/lib/ai/ratelimit";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageStreamWriter,
} from "ai";
import {
  buildMedeaGeneralPrompt,
  MEDEA_GENERAL_SYSTEM_PROMPT,
  MEDEA_DOCUMENT_SYSTEM_PROMPT,
  parseMedeaChatRequest,
} from "@/lib/ai/chat-request";
import { generateMedeaReply } from "@/lib/ai/medea-service";
import { SUPABASE_ADMIN_CONFIG_ERROR_CODE, createSupabaseAdminClient, isSupabaseAdminConfigError } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

function createMedeaStreamResponse(
  execute: (writer: UIMessageStreamWriter) => Promise<void> | void
) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => execute(writer),
    }),
  });
}

function writeData(writer: UIMessageStreamWriter, type: `data-${string}`, data: unknown) {
  writer.write({ type, data } as any);
}

function writeText(writer: UIMessageStreamWriter, id: string, delta: string) {
  writer.write({ type: "text-delta", id, delta });
}

type MedeaDocumentReadiness =
  | "ready"
  | "processing"
  | "failed";

const MEDEA_DOCUMENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MEDEA_DOCUMENT_PROCESSING_STATUSES =
  new Set([
    "uploaded",
    "queued",
    "extracting",
    "analyzing",
    "generating",
  ]);

const MEDEA_DOCUMENT_FAILED_STATUSES =
  new Set([
    "failed",
    "cancelled",
  ]);

function medeaDocumentJson(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        "Cache-Control":
          "private, no-store",
      },
    },
  );
}

function mapMedeaDocumentReadiness(
  status: string,
): MedeaDocumentReadiness {
  if (
    MEDEA_DOCUMENT_PROCESSING_STATUSES.has(
      status,
    )
  ) {
    return "processing";
  }

  if (
    MEDEA_DOCUMENT_FAILED_STATUSES.has(
      status,
    )
  ) {
    return "failed";
  }

  /*
   * "completed" still needs a usable
   * document_chunks row before it can
   * become "ready".
   *
   * Unknown states fail closed.
   */
  return "failed";
}

export async function GET(
  request: Request,
): Promise<Response> {
  try {
    /*
     * Authentication mirrors the existing
     * POST behavior:
     *
     * - Bearer token when supplied
     * - otherwise cookie-aware getUser()
     */
    const supabase =
      await createClient();

    const authorization =
      request.headers.get(
        "authorization",
      );

    const bearerToken =
      authorization
        ?.match(
          /^Bearer\s+(.+)$/i,
        )?.[1]
        ?.trim();

    const authResult =
      bearerToken
        ? await supabase.auth.getUser(
            bearerToken,
          )
        : await supabase.auth.getUser();

    const user =
      authResult.data.user;

    if (
      authResult.error ||
      !user
    ) {
      return medeaDocumentJson(
        {
          error:
            "UNAUTHORIZED",
        },
        401,
      );
    }

    /*
     * Authentication happens before ID
     * validation so signed-out callers do
     * not learn anything about the request.
     */
    const url =
      new URL(request.url);

    const documentId =
      (
        url.searchParams.get(
          "documentId",
        ) ?? ""
      ).trim();

    if (
      !MEDEA_DOCUMENT_UUID_PATTERN.test(
        documentId,
      )
    ) {
      return medeaDocumentJson(
        {
          error:
            "INVALID_DOCUMENT_ID",
        },
        400,
      );
    }

    const admin =
      createSupabaseAdminClient();

    /*
     * Ownership is proved in the database
     * lookup itself.
     *
     * Do not query by document ID first and
     * then compare user_id afterward.
     */
    const {
      data: document,
      error: documentError,
    } =
      await admin
        .from("documents")
        .select(
          "id, filename, status",
        )
        .eq(
          "id",
          documentId,
        )
        .eq(
          "user_id",
          user.id,
        )
        .maybeSingle();

    /*
     * Internal lookup failures must not
     * expose database details.
     */
    if (documentError) {
      return medeaDocumentJson(
        {
          error:
            "DOCUMENT_SOURCE_UNAVAILABLE",
        },
        503,
      );
    }

    /*
     * Missing and foreign documents are
     * intentionally indistinguishable
     * because this query is owner-scoped.
     */
    if (!document) {
      return medeaDocumentJson(
        {
          error:
            "DOCUMENT_NOT_FOUND",
        },
        404,
      );
    }

    let readiness:
      MedeaDocumentReadiness =
      mapMedeaDocumentReadiness(
        document.status,
      );

    /*
     * A completed lifecycle row alone is
     * insufficient.
     *
     * At least one extracted chunk must
     * contain non-whitespace source text.
     */
    if (
      document.status ===
      "completed"
    ) {
      const {
        data: chunks,
        error: chunkError,
      } =
        await admin
          .from(
            "document_chunks",
          )
          .select("content")
          .eq(
            "document_id",
            documentId,
          );

      if (chunkError) {
        return medeaDocumentJson(
          {
            error:
              "DOCUMENT_SOURCE_UNAVAILABLE",
          },
          503,
        );
      }

      const hasUsableChunk =
        Array.isArray(chunks) &&
        chunks.some(
          (chunk) =>
            typeof chunk?.content ===
              "string" &&
            chunk.content.trim()
              .length > 0,
        );

      readiness =
        hasUsableChunk
          ? "ready"
          : "failed";
    }

    /*
     * Safe metadata only.
     *
     * Do not add user_id, chunk content,
     * storage information, or extracted
     * source text here.
     */
    return medeaDocumentJson({
      documentId:
        document.id,

      fileName:
        document.filename,

      readiness,
    });
  } catch {
    return medeaDocumentJson(
      {
        error:
          "DOCUMENT_SOURCE_UNAVAILABLE",
      },
      503,
    );
  }
}

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
      const content = await generateMedeaReply({
        system: chatRequest.documentContext.trim() ? MEDEA_DOCUMENT_SYSTEM_PROMPT : MEDEA_GENERAL_SYSTEM_PROMPT,
        prompt: buildMedeaGeneralPrompt(chatRequest),
        question: chatRequest.question,
        userId: user.id,
        documentGrounded: !!chatRequest.documentContext.trim(),
      });
      return NextResponse.json({ content });
    } catch (error) {
      console.error("Medea general chat error:", error);
      return NextResponse.json(
        { error: "Medea couldn't generate an answer right now. Please try again." },
        { status: 500 }
      );
    }
  }

  const { documentId, message, requestId } = chatRequest;

  let serviceClient;
  try {
    serviceClient = createSupabaseAdminClient<any>();
  } catch (error) {
    if (isSupabaseAdminConfigError(error)) {
      return NextResponse.json(
        { error: "This operation is temporarily unavailable. Please try again later.", code: SUPABASE_ADMIN_CONFIG_ERROR_CODE },
        { status: 503 },
      );
    }
    throw error;
  }

  // 1. Authorization: verify user owns this document
  const { data: document, error: docError } = await serviceClient
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (docError) {
    return new Response(
      JSON.stringify({
        error: "DOCUMENT_SOURCE_UNAVAILABLE",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 403 });
  }

  if (document.status !== "completed") {
    return new Response(
      JSON.stringify({
        error: "DOCUMENT_NOT_READY",
      }),
      {
        status: 409,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const {
    data: documentChunks,
    error: documentChunksError,
  } = await serviceClient
    .from("document_chunks")
    .select("content")
    .eq("document_id", documentId);

  if (documentChunksError) {
    return new Response(
      JSON.stringify({
        error: "DOCUMENT_SOURCE_UNAVAILABLE",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const hasUsableDocumentChunk =
    Array.isArray(documentChunks) &&
    documentChunks.some(
      (chunk) =>
        typeof chunk?.content === "string" &&
        chunk.content.trim().length > 0,
    );

  if (!hasUsableDocumentChunk) {
    return new Response(
      JSON.stringify({
        error: "DOCUMENT_NOT_READY",
      }),
      {
        status: 409,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      },
    );
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
      return createMedeaStreamResponse(async (writer) => {
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

          const textId = crypto.randomUUID();
          writer.write({ type: "start" });
          writeData(writer, "data-recovered", { recovered: true });
          if (citations) {
             writeData(writer, "data-citation", { citations });
          }
          writer.write({ type: "text-start", id: textId });
          writeText(writer, textId, reply?.content || "");
          writer.write({ type: "text-end", id: textId });
          writer.write({ type: "finish" });
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

  return createMedeaStreamResponse(async (writer) => {
      try {
        const textId = crypto.randomUUID();
        writer.write({ type: "start" });
        writeData(writer, "data-tutor-status", { label: "Retrieving context..." });

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
          role: h.role === "assistant" ? "assistant" : "user",
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

        writeData(writer, "data-tutor-status", { label: "Generating answer..." });

        // 9. Generate & Stream Text natively
        const stream = await ProviderAdapter.stream({
           operation: "chat",
           prompt,
           systemInstruction: systemPrompt
        });

        let fullContent = "";
        writer.write({ type: "text-start", id: textId });
        for await (const chunk of stream) {
           // Handle Google GenAI chunk structure
           const textChunk = chunk.text || "";
           if (textChunk) {
              writeText(writer, textId, textChunk);
              fullContent += textChunk;
           }
        }
        writer.write({ type: "text-end", id: textId });

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
        writer.write({ type: "finish" });
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
  });
}
