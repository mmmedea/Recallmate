import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { callGroqChat, withFallback, GROQ_MODEL } from "@/lib/ai-provider";

export const runtime = "nodejs";
// Pin to US East where Gemini API is fully available (avoids EU geo-block)
export const preferredRegion = "iad1";

/**
 * Medea AI Tutor — Structured JSON Chat Route (v5 — Hybrid Free Tier)
 *
 * Changes in v5:
 *  1. Gemini 1.5 Flash remains the primary engine (free tier, strict JSON schema).
 *  2. Groq Llama 3.1 70B is the automatic fallback (free tier, JSON mode).
 *     If Gemini hits its 15 RPM rate limit or fails for any reason, Groq
 *     silently takes over — zero downtime for the student.
 *  3. Both paths preserve the Medea persona and internal_reasoning quarantine.
 */

// ── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY || ""
);

// ── Bulletproof YouTube ID extractor ─────────────────────────────────────────
// Handles: full links, short links (youtu.be), /shorts/, /embed/,
//          and any trailing tracking params (?si=..., &feature=..., etc.)
function extractYouTubeId(url: string): string | null {
  const regExp =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
}

// ── Shared JSON response schema (Gemini path) ─────────────────────────────────
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

// ── Medea system persona ──────────────────────────────────────────────────────
const MEDEA_PERSONA = `You are Medea, the brilliant, friendly, and highly encouraging AI Tutor & Smart Dictionary for RecallMate.
Your mission: make complicated academic subjects — physics, math, chemistry, history, geometry — incredibly easy to understand using vivid real-world analogies, clear worked examples, and warm encouragement.

You output STRICT JSON. Your thinking goes into internal_reasoning (never shown to students).
Your clean_response is the ONLY text the student sees — never output meta-tags, constraint labels, or planning headers.
Strip all conversational greetings, redundant "Hellos", and internal planning monologues from clean_response.

Rules for clean_response:
- Natural paragraphs and clean lists only. No stray #, *, _ symbols.
- All equations, formulas, and chemical reactions wrapped in LaTeX: $...$ (inline) or $$...$$ (block).
- For definitions: provide clear meaning + a vivid real-world analogy.
- For calculations: show clearly numbered steps with LaTeX.
- Follow elite Coherence, Cohesion, and Organizational patterns (combining Description, Chronological/Sequence, and Cause & Effect structures).
- Never echo "internal_reasoning" content, never say "Constraint 1:", never output "* User says...".`;

// ── Groq system prompt (adapted for JSON mode without strict schema) ───────────
const GROQ_SYSTEM_PROMPT = `${MEDEA_PERSONA}

IMPORTANT: You MUST respond with ONLY a valid JSON object in this exact shape:
{
  "internal_reasoning": "<your private step-by-step thinking — never shown to students>",
  "clean_response": "<your final warm tutoring response with LaTeX where needed>",
  "recommended_questions": ["question 1", "question 2", "question 3"]
}
No text outside the JSON object. No markdown code fences.`;

// ── Shared JSON parser used by both providers ─────────────────────────────────
function parseStructuredResponse(rawText: string): {
  cleanResponse: string;
  recommendedQuestions: string[];
} {
  try {
    // 1. LaTeX Normalization: Convert \( \) and \[ \] to $ and $$
    let normalizedText = rawText
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$")
      .replace(/\\\[/g, "$$")
      .replace(/\\\]/g, "$$");

    // 2. JSON Truncation Patching
    let patchedText = normalizedText;
    if (!patchedText.trim().endsWith("}")) {
      const patches = ['"}', '"]}', ']}', '}'];
      for (const patch of patches) {
        try {
          JSON.parse(patchedText + patch);
          patchedText += patch;
          break;
        } catch (e) {}
      }
    }

    const parsed = JSON.parse(patchedText);
    // internal_reasoning is extracted and permanently DISCARDED server-side
    const cleanResponse = (parsed.clean_response || "").trim();
    const recommendedQuestions = Array.isArray(parsed.recommended_questions)
      ? parsed.recommended_questions.filter(
          (q: unknown): q is string =>
            typeof q === "string" && q.trim().length > 0
        )
      : [];
    return { cleanResponse, recommendedQuestions };
  } catch {
    // Graceful fallback: treat raw text as the response
    return { cleanResponse: rawText.trim(), recommendedQuestions: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasGemini = !!(process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY);
    const hasGroq = !!process.env.GROQ_API_KEY;

    if (!hasGemini && !hasGroq) {
      return NextResponse.json(
        { error: "Server Configuration Error: No AI provider keys are configured." },
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

    // ── FEYNMAN EVALUATION (lightweight, non-JSON path) ───────────────────────
    if (isFeynmanEvaluation) {
      const feynmanPrompt = `You are Medea, evaluating a student's explanation using the Feynman Technique.
Rate clarity and semantic accuracy from 1 to 3 hearts. End with EXACT JSON: {"heartsEarned": 1|2|3}

Student explanation:
${lastUserMessage}`;

      const feynmanText = await withFallback(
        async () => {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(feynmanPrompt);
          return result.response.text();
        },
        async () => {
          return await callGroqChat(
            "You are Medea, an AI tutor evaluating student explanations. Always end your response with JSON: {\"heartsEarned\": 1|2|3}",
            `Evaluate this student explanation using the Feynman Technique. Rate 1-3 hearts based on clarity and accuracy.\n\n${lastUserMessage}`,
            { jsonMode: false }
          );
        },
        "Feynman"
      );

      return NextResponse.json({ role: "assistant", content: feynmanText });
    }

    // ── DETECT YOUTUBE LINK ───────────────────────────────────────────────────
    const youtubeVideoId = extractYouTubeId(lastUserMessage);
    let youtubeTitle = "YouTube Video";

    if (youtubeVideoId) {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeVideoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          youtubeTitle = oembedData.title || youtubeTitle;
        }
      } catch (err) {
        console.warn("Failed to fetch YouTube title via oembed", err);
      }
    }

    // ── BUILD CONTEXT BLOCKS ──────────────────────────────────────────────────
    const documentBlock = documentContext
      ? `\n\n## ACTIVE STUDY MATERIAL (uploaded by student):\n"""\n${documentContext.slice(0, 8000)}\n"""\n`
      : "";

    const youtubeBlock = youtubeVideoId
      ? `\n\n## YOUTUBE VIDEO LINK DETECTED (Video ID: ${youtubeVideoId}, Title: "${youtubeTitle}"):
In your clean_response you MUST:
1. Open STRICTLY with "I've summarized it and here is the result:\\n\\n**${youtubeTitle}**".
2. Strip all conversational greetings, redundant "Hellos", and internal planning monologues.
3. Follow elite Coherence, Cohesion, and Organizational patterns.
4. Structure the summary strictly combining Description, Chronological/Sequence, and Cause & Effect structures using Roman Numerals (I, II, III).
5. For example: "I. Conceptual Overview (Description Pattern)", "II. Step-by-Step... (Sequence Pattern)", "III. Scientific Implications (Cause and Effect Pattern)".
Your recommended_questions MUST be directly relevant to the video topic.`
      : "";

    // ── ASSEMBLE FULL PROMPT ──────────────────────────────────────────────────
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

    // ── HYBRID CALL: Gemini (primary) → Groq (fallback) ─────────────────────
    const rawText = await withFallback(
      // PRIMARY: Gemini 1.5 Flash with strict JSON schema
      async () => {
        if (!hasGemini) throw new Error("Gemini key not configured.");
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
        const text = result.response.text();
        if (!text) throw new Error("Gemini returned empty response.");
        return text;
      },
      // FALLBACK: Groq Llama 3.1 70B with JSON mode
      async () => {
        if (!hasGroq) throw new Error("Groq key not configured.");
        return await callGroqChat(
          GROQ_SYSTEM_PROMPT,
          `${documentBlock}${youtubeBlock}

## CONVERSATION HISTORY:
${conversationHistory || "No prior conversation yet."}

## STUDENT'S CURRENT MESSAGE:
${lastUserMessage}`,
          { temperature: 0.7, maxTokens: 3000, jsonMode: true }
        );
      },
      "Medea Chat"
    );

    // ── PARSE STRUCTURED JSON ─────────────────────────────────────────────────
    const { cleanResponse, recommendedQuestions } = parseStructuredResponse(rawText);

    if (!cleanResponse) {
      return NextResponse.json(
        { error: "Medea did not generate a response. Please try again." },
        { status: 500 }
      );
    }

    // ── BUILD FINAL CLIENT PAYLOAD ────────────────────────────────────────────
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
