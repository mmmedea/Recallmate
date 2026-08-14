import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createUIMessageStreamResponse, createUIMessageStream } from "ai";
import { TutorStatusPhase } from "@/lib/ai/tutor/stream";
import { Database } from "@/types/supabase";
import { LexicalRetriever } from "@/lib/ai/retriever";
import { BillingService } from "@/lib/ai/billing";
import { ProviderAdapter } from "@/lib/ai/provider";
import { ModelRegistry } from "@/lib/ai/config";
import { detectTutorIntent } from "@/lib/ai/tutor/intent";
import { selectTutorStrategy } from "@/lib/ai/tutor/strategy";
import { ToolExecutor } from "@/lib/ai/tutor/tools/executor";
import { VerificationOrchestrator } from "@/lib/ai/tutor/verification/orchestrator";
import { getToolDefinition } from "@/lib/ai/tutor/tools/registry";
import { zodToJsonSchema } from "zod-to-json-schema";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

// 7.2.1 Request Contract
const ChatRequestSchema = z.object({
  documentId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
}).strict();

type InteractionStatus = "generating" | "completed" | "aborted" | "failed";
type MessageRole = "user" | "assistant";

type InteractionStatus = "generating" | "completed" | "aborted" | "failed";
type MessageRole = "user" | "assistant";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 7.2.2 Authentication + document authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = ChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { documentId, message, conversationId, requestId } = parseResult.data;

    // Service Role Client for Security Enforcements
    const serviceClient = createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify document belongs to authenticated user
    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .select("id, title")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 403 });
    }

    // 7.2.3 Conversation resolution
    let resolvedConversationId = conversationId;
    if (conversationId) {
      const { data: existingConv, error: existingConvError } = await serviceClient
        .from("conversations")
        .select("id, document_id, user_id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();
      
      if (existingConvError || !existingConv) {
         return NextResponse.json({ error: "Conversation not found or unauthorized" }, { status: 403 });
      }
      if (existingConv.document_id !== documentId) {
         return NextResponse.json({ error: "Conversation does not match requested document" }, { status: 403 });
      }
    } else {
      const { data: conv } = await serviceClient
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("document_id", documentId)
        .maybeSingle();

      if (conv) {
        resolvedConversationId = conv.id;
      } else {
        const { data: newConv, error: insertConvError } = await serviceClient
          .from("conversations")
          .insert({
            user_id: user.id,
            document_id: documentId,
          })
          .select("id")
          .single();
        
        if (insertConvError) {
          if (insertConvError.code === '23505') {
            const { data: racedConv } = await serviceClient
              .from("conversations")
              .select("id")
              .eq("user_id", user.id)
              .eq("document_id", documentId)
              .single();
            if (racedConv) resolvedConversationId = racedConv.id;
          } else {
             return NextResponse.json({ error: "Failed to resolve conversation" }, { status: 500 });
          }
        } else {
          resolvedConversationId = newConv.id;
        }
      }
    }

    if (!resolvedConversationId) {
       return NextResponse.json({ error: "Failed to resolve conversation" }, { status: 500 });
    }

    // 7.3 Resume Behavior & Idempotency
    const { data: existingInteraction } = await serviceClient
      .from("chat_interactions")
      .select("id, status, error_message, billing_job_id")
      .eq("user_id", user.id)
      .eq("request_id", requestId)
      .maybeSingle();

    if (existingInteraction) {
      if (existingInteraction.status === "completed") {
        // Return existing persisted answer
        const { data: existingAssistantMessage } = await serviceClient
           .from("chat_messages")
           .select("content, id")
           .eq("interaction_id", existingInteraction.id)
           .eq("role", "assistant")
           .single();
           
        const { data: existingCitations } = await serviceClient
           .from("chat_citations")
           .select("*")
           .eq("interaction_id", existingInteraction.id);

        return NextResponse.json({ 
            success: true, 
            status: "completed",
            interactionId: existingInteraction.id,
            message: existingAssistantMessage?.content || "",
            citations: existingCitations || []
        });
      } else if (existingInteraction.status === "generating") {
        return NextResponse.json({ success: true, status: "generating", interactionId: existingInteraction.id });
      } else {
        return NextResponse.json({ error: `Interaction was ${existingInteraction.status}. Requires new requestId.` }, { status: 409 });
      }
    }

    // 7.2.5 Server-owned identities & Billing binding sequence
    const interactionId = crypto.randomUUID();
    const billingJobId = `chat_${crypto.randomUUID()}`;
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    
    // Create the billing job
    const { error: jobError } = await serviceClient
      .from("ai_jobs")
      .insert({
        id: billingJobId,
        user_id: user.id,
        operation: "chat",
        status: "in_progress",
        idempotency_key: requestId,
        document_id: documentId,
        generation_version: 1
      });

    if (jobError) {
      console.error("Failed to create ai_job:", jobError);
      return NextResponse.json({ error: "Failed to initialize billing record" }, { status: 500 });
    }

    // Insert interaction
    const { error: interactionError } = await serviceClient
      .from("chat_interactions")
      .insert({
        id: interactionId,
        user_id: user.id,
        conversation_id: resolvedConversationId,
        request_id: requestId,
        status: "generating" as InteractionStatus,
        billing_job_id: billingJobId
      });

    if (interactionError) {
      if (interactionError.code === '23505') {
        return NextResponse.json({ error: "Duplicate request ID. Interaction already in progress." }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to initialize interaction" }, { status: 500 });
    }

    // 7.3.1 Persist the user message securely linked to the interaction
    await serviceClient
      .from("chat_messages")
      .insert({
        id: userMessageId,
        interaction_id: interactionId,
        conversation_id: resolvedConversationId,
        user_id: user.id,
        role: "user" as MessageRole,
        content: message
      });
      
    // 7.3.5 Create the assistant message before streaming
    await serviceClient
      .from("chat_messages")
      .insert({
        id: assistantMessageId,
        interaction_id: interactionId,
        conversation_id: resolvedConversationId,
        user_id: user.id,
        role: "assistant" as MessageRole,
        content: ""
      });

    const billingService = new BillingService(serviceClient);
    const estimatedCost = 10;
    // Reserve credits BEFORE any retrieval or streaming
    await billingService.reserveCredits(user.id, billingJobId, estimatedCost, `Reserve: chat turn`);

    try {
       // 7.3.2, 7.3.3 & 7.3.9 Load history from the server (Bounded & Deterministic)
       // We load an initial bound to detect intent, then limit further if needed
       const { data: historyData } = await serviceClient
         .from("chat_messages")
         .select("role, content, created_at")
         .eq("conversation_id", resolvedConversationId)
         // Exclude the current interaction's messages from history prompt so we don't duplicate
         .neq("interaction_id", interactionId) 
         .order("created_at", { ascending: false })
         .order("id", { ascending: false }) // deterministic tie-breaker
         .limit(10);
         
       const historyMessagesFinal = (historyData || []).reverse();

       // 7.5.9 Integrate Tutor Routing
       const historySummary = historyMessagesFinal.map(m => m.content).join(" ").substring(0, 500);
       const tutorIntent = await detectTutorIntent(message, document.title, historySummary);
       const tutorPlan = selectTutorStrategy(tutorIntent);
       
       // Slice history according to dynamic context budget
       const budgetedHistory = historyMessagesFinal.slice(-tutorPlan.contextBudget.maxChunks);

       // 7.4 Grounded Retrieval Boundary
       let contextText = "";
       let retrievedAliasMap: { id: string; alias: string }[] = [];
       const retriever = new LexicalRetriever(serviceClient);
       const chunks = await retriever.search({
           query: message,
           userId: user.id,
           authorizedDocumentIds: [documentId],
           limit: tutorPlan.contextBudget.maxChunks
       });

       if (!chunks || chunks.length === 0) {
           // 7.4.6 No-evidence behavior (Strict Grounding)
           const noEvidenceMessage = "I couldn't find that in the selected document.";
           
           // Fast-path completion without hitting the provider
           await billingService.finalizeCharge(user.id, billingJobId, estimatedCost, 0, `Finalized minimal chat charge for no evidence`);
           await serviceClient.from("chat_messages").update({ content: noEvidenceMessage }).eq("id", assistantMessageId);
           await serviceClient.from("chat_interactions").update({ status: "completed" as InteractionStatus, completed_at: new Date().toISOString() }).eq("id", interactionId);
           
           // Return as a simple complete stream
           const stream = new ReadableStream({
               start(controller) {
                   controller.enqueue(new TextEncoder().encode(noEvidenceMessage));
                   controller.close();
               }
           });
           return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
       }

       // Create opaque aliases (S1, S2, S3...)
       contextText = "\n\n--- DOCUMENT EVIDENCE ---\n--- START UNTRUSTED DOCUMENT MATERIAL ---\n\n" + 
                     chunks.map((c, idx) => `[S${idx+1}]\n${c.content}`).join('\n\n') +
                     "\n\n--- END UNTRUSTED DOCUMENT MATERIAL ---";
                     
       // Ephemeral alias map
       retrievedAliasMap = chunks.map((c, idx) => ({
         id: c.id,
         alias: `S${idx+1}`
       }));

       // 7.3.4 & 7.4.10 Strict partitioning of context and instructions
       const systemInstruction = tutorPlan.systemPrompt;
       
       let conversationHistoryContext = "";
       if (budgetedHistory.length > 0) {
           conversationHistoryContext = "--- CONVERSATION HISTORY ---\n" + 
                                        budgetedHistory.map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n\n') +
                                        "\n--- END HISTORY ---\n\n";
       }
       
       const promptWithContext = conversationHistoryContext + `--- CURRENT QUESTION ---\nStudent: ${message}` + contextText;

        // 7.6 Integrate Tools
        const executor = new ToolExecutor(tutorPlan);
        const verifier = new VerificationOrchestrator(tutorPlan);
        
        const geminiTools: any[] = [];
        for (const toolName of tutorPlan.tools) {
            const def = getToolDefinition(toolName);
            if (def) {
                if (def.isNativeCodeExecution) {
                    if (!geminiTools.some(t => t.codeExecution)) {
                        geminiTools.push({ codeExecution: {} });
                    }
                } else if (def.schema) {
                    // Provide a custom function declaration
                    geminiTools.push({
                        functionDeclarations: [{
                            name: def.name,
                            description: def.description,
                            parameters: zodToJsonSchema(def.schema)
                        }]
                    });
                }
            }
        }

       // Helper to build tools, if we need it for generation
       const getTools = () => geminiTools.length > 0 ? geminiTools : undefined;

       // 7.7 Two-Pass Architecture using createUIMessageStreamResponse
       return createUIMessageStreamResponse({
         stream: createUIMessageStream({
           execute: async ({ writer }) => {
             const sendStatus = (phase: TutorStatusPhase, label: string) => {
               writer.write({ type: "message-annotation", data: { type: "data-tutor-status", data: { phase, label } } });
             };
           
           try {
             // Pass 1: Generate
             sendStatus("working", "RecallMate is thinking...");
             
             let finalResponse = "";
             let totalCostTokens = 0;
             let isVerified = true;
             let verificationIssues: string[] = [];
             let checks = {};

             const pass1 = await ProviderAdapter.generate({
                 operation: 'tutor',
                 systemInstruction,
                 prompt: promptWithContext,
                 tools: getTools()
             });
             
             totalCostTokens += pass1.usage.totalTokens;
             
             const toolResults: any[] = []; // Populate with actual tool executions

             sendStatus("checking_calculation", "Checking calculations...");
             const vResult = verifier.verify(toolResults);
             isVerified = vResult.verified;
             verificationIssues = vResult.issues;
             checks = vResult.checks;

             if (!isVerified) {
                sendStatus("repairing", "Verifying and repairing answer...");
                // Pass 2: Repair
                const repairPrompt = promptWithContext + `\n\n--- FIRST PASS ANSWER ---\n${pass1.text}\n\n--- VERIFICATION ISSUES ---\n${verificationIssues.map(i => "- " + i).join("\n")}\n\nPlease correct the answer based on the issues found.`;
                
                const pass2 = await ProviderAdapter.generate({
                   operation: 'tutor',
                   systemInstruction,
                   prompt: repairPrompt,
                   tools: getTools()
                });
                
                totalCostTokens += pass2.usage.totalTokens;
                
                // Verify again
                const vResult2 = verifier.verify(toolResults);
                if (!vResult2.verified) {
                   isVerified = false;
                   finalResponse = "I worked through the calculation, but I couldn't complete the verification step reliably.\n\n" + pass2.text;
                } else {
                   isVerified = true;
                   finalResponse = pass2.text;
                }
             } else {
                finalResponse = pass1.text;
             }

             sendStatus("finalizing", "Finalizing answer...");
             
             // 7.8 Citation Validation & Extraction
             const citedAliases = Array.from(finalResponse.matchAll(/\[(S\d+)\]/g)).map(m => m[1]);
             const uniqueCitedAliases = Array.from(new Set(citedAliases));
             
             const actualCitationsToPersist = retrievedAliasMap
               .filter(map => uniqueCitedAliases.includes(map.alias))
               .map(map => ({
                 id: crypto.randomUUID(),
                 interaction_id: interactionId,
                 message_id: assistantMessageId,
                 source_chunk_id: map.id,
                 alias: map.alias
               }));

             // Emit Citation Parts
             actualCitationsToPersist.forEach((citation) => {
                writer.write({
                  type: "message-annotation",
                  data: {
                    type: "data-citation",
                    data: {
                      citationId: citation.id,
                      label: `Document Reference`,
                    }
                  }
                });
             });

             // Emit Verification Part
             writer.write({
               type: "message-annotation",
               data: {
                 type: "data-verification",
                 data: { verified: isVerified, checks }
               }
             });

             // Strip aliases from final UI text to ensure clean presentation
             let cleanText = finalResponse.replace(/\[S\d+\]/g, "");
             
             // Stream the clean text immediately (no artificial delay)
             writer.write({ type: "text", textDelta: cleanText });

             // Finalize Billing
             const actualCost = Math.max(1, Math.ceil(totalCostTokens / 1000));
             await billingService.finalizeCharge(user.id, billingJobId, estimatedCost, actualCost, `Finalized chat charge for ${totalCostTokens} tokens`);
             await billingService.logUsage({
               userId: user.id,
               jobId: billingJobId,
               operation: 'chat',
               provider: ModelRegistry.chat.provider,
               model: ModelRegistry.chat.model,
               status: 'completed',
               usageMetadata: { total_tokens: totalCostTokens }
             });

             // Persist Message & Citations (Server retains original text for debugging or canonical source if preferred, 
             // but here we save the clean text to keep history readable)
             await serviceClient.from("chat_messages").update({ content: cleanText }).eq("id", assistantMessageId);
             
             if (actualCitationsToPersist.length > 0) {
               await serviceClient.from("chat_citations").insert(actualCitationsToPersist);
             }

             await serviceClient.from("chat_interactions").update({
                status: "completed" as InteractionStatus,
                completed_at: new Date().toISOString()
             }).eq("id", interactionId);

           } catch (streamErr: any) {
             console.error("Stream Error:", streamErr);
             await serviceClient.from("chat_interactions").update({
                status: "failed" as InteractionStatus,
                error_message: streamErr.message
             }).eq("id", interactionId);
             await billingService.recordLedgerEntry({
                userId: user.id,
                jobId: billingJobId,
                entryType: 'REFUND',
                credits: estimatedCost,
                reason: 'Refund due to stream error'
             });
             throw streamErr;
           }
         },
         onError: (error) => {
           console.error("Data Stream Error:", error);
           return "An error occurred while streaming the response.";
         }
       })
       });

    } catch (e: any) {
        await serviceClient.from("chat_interactions").update({
           status: "failed" as InteractionStatus,
           error_message: e.message
        }).eq("id", interactionId);

        await billingService.recordLedgerEntry({
            userId: user.id,
            jobId: billingJobId,
            entryType: 'REFUND',
            credits: estimatedCost,
            reason: 'Refund due to failure before stream'
        });
        throw e;
    }

  } catch (err: any) {
    console.error("Chat Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
