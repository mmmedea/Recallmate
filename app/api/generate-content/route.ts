import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { buildDocumentNotesFallback } from "@/lib/ai/document-notes-fallback";
import { requireUser, requireDocumentOwner, requireEntitlement, checkRateLimit, getOrCreateIdempotentJob, SecurityError } from "@/lib/security";
import { normalizeQuizCount, normalizeQuizDifficulty } from "@/lib/ai/quiz-policy";
import { sourceAcademicText, sourceFromText } from '@/lib/source/academic-source';
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateQuiz, QUIZ_GENERATION_RETRY_MESSAGE } from "@/lib/quiz/generator";
import type { QuizQuestionFormat } from "@/lib/quiz/schema";
import { sampleQuizSourceText } from "@/lib/quiz/source-sampler";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

// ==========================================
// RATE LIMITING SETUP (Redis + In-Memory Fallback)
// ==========================================

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const hasRedis = Boolean(redisUrl && redisToken);

const redis = hasRedis ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Fallback: Simple in-memory rate limiter for local dev or if Redis is unconfigured
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5;   // Max 5 generations per minute
const QUIZ_RETRY_MESSAGE = QUIZ_GENERATION_RETRY_MESSAGE;

function isRateLimitedInMemory(ip: string): boolean {
  const now = Date.now();
  const userRecord = rateLimitMap.get(ip);

  if (!userRecord || now - userRecord.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return false;
  }

  if (userRecord.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  userRecord.count += 1;
  return false;
}

// ==========================================
// SECURITY GUARDRAILS & HELPERS
// ==========================================

function applyInputGuardrails(text: string): { safe: boolean; reason?: string } {
  if (!text || text.trim().length < 10) {
    return { safe: false, reason: "Extracted content is too short for processing." };
  }

  return { safe: true };
}

// ==========================================
// MAIN API ROUTE
// ==========================================

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    // 1 & 2: Authenticate & Derive user purely from server session
    const { supabase, user } = await requireUser();

    // 3: Parse and Validate Request
    const body = await req.json();
    const { text, fileName, count = 10, difficulty = "easy", format = "multiple_choice", documentId, idempotencyKey, purpose } = body;
    
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid text input." }, { status: 400 });
    }

    if (
      (documentId !== undefined && documentId !== null && typeof documentId !== "string") ||
      (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard" && difficulty !== "mixed")
    ) {
      return NextResponse.json({ error: "Invalid quiz setup." }, { status: 400 });
    }

    // 4: Authorize Resource Ownership (if generating from a saved document)
    if (documentId) {
      await requireDocumentOwner(documentId);
    }

    // 5: Check Entitlement
    const { isPremium } = await requireEntitlement();
    const requestedCount = normalizeQuizCount(count, isPremium);
    const normalizedDifficulty = normalizeQuizDifficulty(difficulty);
    if (format !== "multiple_choice" && format !== "identification" && format !== "mixed") {
      return NextResponse.json({ error: "Invalid question format." }, { status: 400 });
    }
    const normalizedFormat: QuizQuestionFormat = format === "identification" || format === "mixed"
      ? format
      : "multiple_choice";

    if (normalizedFormat !== "multiple_choice" && !documentId) {
      return NextResponse.json({ error: "Identification questions require a saved lesson." }, { status: 400 });
    }

    // 6: Rate Limit
    await checkRateLimit(user.id);

    // Preserve source Notes rather than displaying unverified AI paraphrases.
    if (purpose === 'notes') {
      if (text.length > 1_000_000) return NextResponse.json({ error: 'Source is too large to organize safely.' }, { status: 413 });
      return NextResponse.json(buildDocumentNotesFallback(text, fileName || 'Study notes'));
    }

    // 7: Check Idempotency (if an idempotency key is provided)
    if (idempotencyKey && documentId) {
      await getOrCreateIdempotentJob(supabase, user.id, idempotencyKey, documentId, 'generate_quiz');
    }

    // 8: INPUT RAIL VALIDATION & CAPPING
    const safeText = sampleQuizSourceText(
      sourceAcademicText(sourceFromText(text, fileName || 'Uploaded lesson'), true),
    );
    const inputValidation = applyInputGuardrails(safeText);

    if (!inputValidation.safe) {
      console.warn(`[AUDIT] Security violation by user ${user.id}: ${inputValidation.reason}`);
      return NextResponse.json({ error: inputValidation.reason }, { status: 400 });
    }
    
    console.log(`[AUDIT] User ${user.id} initiated AI generation for ${documentId ? `document ${documentId}` : 'ephemeral text'}`);

    // Generate through the shared structured provider abstraction. Local quiz
    // templates are intentionally never used as a provider-failure fallback.
    try {
      const generated = await generateQuiz({
        sourceText: safeText,
        fileName: typeof fileName === "string" ? fileName : "Study material",
        difficulty: normalizedDifficulty,
        format: normalizedFormat,
        count: requestedCount,
      });

      if (generated.protectedAnswers.length > 0) {
        const admin = createSupabaseAdminClient<any>();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const rows = generated.protectedAnswers.map((answer) => ({
          id: answer.id,
          user_id: user.id,
          document_id: documentId,
          answer_text: answer.answer,
          accepted_answers: answer.acceptedAnswers,
          explanation: answer.explanation,
          source_evidence: answer.sourceEvidence,
          expires_at: expiresAt,
        }));
        const { error: insertError } = await admin.from("quiz_identification_answer_keys").insert(rows);
        if (insertError) throw insertError;
      }

      return NextResponse.json({
        fileName: typeof fileName === "string" ? fileName : "Study material",
        difficulty: generated.difficulty,
        format: generated.format,
        requestedCount: generated.requestedCount,
        summary: generated.summary,
        questions: generated.questions,
        quizEngine: generated.report,
      });
    } catch {
      console.error("Quiz generation or answer-key persistence failed.");
      return NextResponse.json({ error: QUIZ_RETRY_MESSAGE }, { status: 503 });
    }
  } catch (err: any) {
    console.error("Study content generation failed:", err?.message || "Unknown error");
    if (err instanceof SecurityError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to generate study content safely." },
      { status: 500 }
    );
  }
}
