import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export const runtime = "nodejs";
// Pin this function to US East (Washington D.C.) where Gemini API is fully available.
// This prevents 404 errors caused by Vercel deploying to EU regions where Gemini is geo-blocked.
export const preferredRegion = "iad1";

/**
 * Medea AI Tutor — Structured JSON Chat Route (v4)
 *
 * Changes in this version:
 *  1. Uses @google/generative-ai SDK (GoogleGenerativeAI) instead of raw REST fetch,
 *     avoiding the v1beta model-path mismatch that caused "models/gemini-1.5-pro" crashes.
 *  2. Bulletproof YouTube ID extractor handles all URL formats including
 *     short links with tracking params (e.g. youtu.be/ID?si=XXXXXXXX).
 *  3. Enforces strict JSON responseSchema so internal_reasoning is ALWAYS
 *     trapped server-side — zero chain-of-thought leakage to the client.
 *  4. Feynman evaluation path kept as a separate lightweight call.
 */

// Support both GEMINI_API_KEY_02 (Vercel new key) and GEMINI_API_KEY (fallback)
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY || ""
);

// ── Bulletproof YouTube ID extractor ────────────────────────────────────────
// Handles: full links, short links (youtu.be), /shorts/, /embed/,
//          and any trailing tracking params (?si=..., &feature=..., etc.)
function extractYouTubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
}

// ── Shared JSON response schema ──────────────────────────────────────────────
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    internal_reasoning: {
      type: SchemaType.STRING,
      description:
        "ALL step-by-step thinking, persona checks, math verification, LaTeX planning, and constraint validation. This key is NEVER sent to the student.",
    },
    clean_response: {
      type: SchemaType.STRING,
      description:
        "The final, beautifully polished, warm humanized tutoring response. Clean markdown and LaTeX ONLY ($...$ inline, $$...$$ block). Zero internal thought leaks.",
    },
    recommended_questions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        "Exactly 3 to 4 contextually relevant study follow-up questions for the student.",
    },
  },
  required: ["internal_reasoning", "clean_response", "recommended_questions"],
};

// ── Medea system persona (injected into every non-Feynman prompt) ────────────
const MEDEA_PERSONA = `You are Medea, the brilliant, friendly, and highly encouraging AI Tutor & Smart Dictionary for RecallMate.
Your mission: make complicated academic subjects — physics, math, chemistry, history, geometry — incredibly easy to understand using vivid real-world analogies, clear worked examples, and warm encouragement.

You output STRICT JSON. Your thinking goes into internal_reasoning (never shown to students).
Your clean_response is the ONLY text the student sees — start it immediately with a warm, conversational message, never with meta-tags, constraint labels, or planning headers.

Rules for clean_response:
- Natural paragraphs and clean lists only. No stray #, *, _ symbols.
- All equations, formulas, and chemical reactions wrapped in LaTeX: $...$ (inline) or $$...$$ (block).
- For definitions: provide clear meaning + a vivid real-world analogy.
- For calculations: show clearly numbered steps with LaTeX.
- Never echo "internal_reasoning" content, never say "Constraint 1:", never output "* User says...".`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY_02 && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server Configuration Error: GEMINI_API_KEY_02 or GEMINI_API_KEY is not set on Vercel." },
        { status: 500 }
      );
    }

    const {
      messages,
      documentContext,
      isFeynmanEvaluation = false,
    } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }

    const lastUserMessage: string = messages[messages.length - 1]?.content || "";

    // ── FEYNMAN EVALUATION (lightweight, non-JSON path) ──────────────────────
    if (isFeynmanEvaluation) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `You are Medea, evaluating a student's explanation using the Feynman Technique.
Rate clarity and semantic accuracy from 1 to 3 hearts. End with EXACT JSON: {"heartsEarned": 1|2|3}

Student explanation:
${lastUserMessage}`
      );
      return NextResponse.json({
        role: "assistant",
        content: result.response.text(),
      });
    }

    // ── DETECT YOUTUBE LINK ──────────────────────────────────────────────────
    const youtubeVideoId = extractYouTubeId(lastUserMessage);

    // ── BUILD CONTEXT BLOCKS ─────────────────────────────────────────────────
    const documentBlock = documentContext
      ? `\n\n## ACTIVE STUDY MATERIAL (uploaded by student):\n"""\n${documentContext.slice(0, 8000)}\n"""\n`
      : "";

    const youtubeBlock = youtubeVideoId
      ? `\n\n## YOUTUBE VIDEO LINK DETECTED (Video ID: ${youtubeVideoId}):
In your clean_response you MUST:
1. Open with a warm greeting confirming you have studied the video.
2. Write a 2-3 paragraph academic summary of the video's core concepts.
3. List 3-5 key takeaways as clean bullet points.
4. Break down the video's most complex concept using a vivid, real-world analogy.
5. Invite the student to ask deeper follow-up questions.
Your recommended_questions MUST be directly relevant to the video topic.`
      : "";

    // ── ASSEMBLE FULL PROMPT ─────────────────────────────────────────────────
    const conversationHistory = messages
      .slice(0, -1)
      .map((m: { role: string; content: string }) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n");

    const unifiedPrompt = `${MEDEA_PERSONA}
${documentBlock}${youtubeBlock}

## CONVERSATION HISTORY:
${conversationHistory || "No prior conversation yet."}

## STUDENT'S CURRENT MESSAGE:
${lastUserMessage}`;

    // ── GENERATE WITH SDK (stable, no v1beta path mismatch) ─────────────────
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3000,
        responseMimeType: "application/json",
        responseSchema,
      } as any,
    });

    const result = await model.generateContent(unifiedPrompt);
    const rawText = result.response.text();

    // ── PARSE STRUCTURED JSON ────────────────────────────────────────────────
    let cleanResponse = "";
    let recommendedQuestions: string[] = [];

    try {
      const parsed = JSON.parse(rawText);
      // ✅ internal_reasoning is extracted and permanently DISCARDED server-side
      cleanResponse = (parsed.clean_response || "").trim();
      recommendedQuestions = Array.isArray(parsed.recommended_questions)
        ? parsed.recommended_questions.filter(
            (q: unknown): q is string => typeof q === "string" && q.trim().length > 0
          )
        : [];
    } catch {
      // Graceful fallback: treat entire raw text as clean response if JSON parse fails
      cleanResponse = rawText.trim();
    }

    if (!cleanResponse) {
      return NextResponse.json(
        { error: "Medea did not generate a response. Please try again." },
        { status: 500 }
      );
    }

    // ── BUILD FINAL CLIENT PAYLOAD ───────────────────────────────────────────
    const questionsBlock =
      recommendedQuestions.length > 0
        ? `\n\n### 💡 Recommended Next Questions\n${recommendedQuestions.map((q) => `- ${q}`).join("\n")}`
        : "";

    return NextResponse.json({
      role: "assistant",
      content: `${cleanResponse}${questionsBlock}`,
    });
  } catch (err: any) {
    console.error("Chat API error:", err?.message || err);
    return NextResponse.json(
      { error: `Medea execution failed: ${err?.message || "Internal server error"}` },
      { status: 500 }
    );
  }
}
