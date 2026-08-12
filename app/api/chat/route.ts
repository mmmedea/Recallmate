import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Medea AI Tutor — Structured JSON Output Chat Route
 *
 * Uses Gemini's responseMimeType: "application/json" + responseSchema to enforce
 * a strict 3-key output object:
 *   - internal_reasoning  → trapped on backend, NEVER sent to client
 *   - clean_response      → the only text sent to the student
 *   - recommended_questions → parsed array rendered as interactive pills
 *
 * This is a foolproof guard: even if Gemini writes thousands of words of chain-of-thought,
 * they are physically isolated in internal_reasoning and discarded server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server Configuration Error: GEMINI_API_KEY is not set." },
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

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Detect YouTube link in last message
    const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const ytMatch = lastUserMessage.match(ytRegex);
    const youtubeVideoId = ytMatch ? ytMatch[1] : null;

    // ─── FEYNMAN EVALUATION (special path, non-JSON) ───────────────────────────
    if (isFeynmanEvaluation) {
      const feynmanSystemPrompt = `You are Medea, evaluating a student's explanation using the Feynman Technique.
Rate clarity and semantic accuracy from 1 to 3 hearts. End with EXACT JSON: {"heartsEarned": 1|2|3}`;

      const feynmanContents = [
        { role: "user", parts: [{ text: feynmanSystemPrompt }] },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        })),
      ];

      const modelCandidates = [
        "models/gemini-2.0-flash",
        "models/gemini-1.5-flash-latest",
        "models/gemini-1.5-flash",
      ];

      for (const modelName of modelCandidates) {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: feynmanContents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) return NextResponse.json({ role: "assistant", content: text });
        }
      }
      return NextResponse.json({ error: "Feynman evaluation failed." }, { status: 500 });
    }

    // ─── MAIN MEDEA TUTOR PATH — STRUCTURED JSON SCHEMA OUTPUT ────────────────

    // Build document / YouTube context block
    const documentBlock = documentContext
      ? `\n\n## ACTIVE STUDY MATERIAL (Uploaded by student):\n"""\n${documentContext.slice(0, 8000)}\n"""\n`
      : "";

    const youtubeBlock = youtubeVideoId
      ? `\n\n## YOUTUBE VIDEO INGESTED (ID: ${youtubeVideoId}):
The student has shared a YouTube video. In your clean_response:
1. Open with a warm greeting confirming you have studied the video.
2. Write a 2-3 paragraph academic summary of the video's core concepts.
3. List 3-5 key takeaways as clean bullet points.
4. Break down the video's most complex concept using a vivid, real-world analogy.
Your recommended_questions MUST be directly related to the video content.`
      : "";

    // System persona injected into the user message (Gemini v1beta doesn't support system role in all configs)
    const systemPersona = `You are Medea, the brilliant, friendly, and highly encouraging AI Tutor & Smart Dictionary for RecallMate.
Your mission: make complicated academic subjects incredibly easy to understand through clear analogies, worked examples, and warm encouragement.

## YOUR OUTPUT IS STRICTLY STRUCTURED JSON — THREE KEYS ONLY:

### KEY 1 — internal_reasoning (string)
Use this block to perform ALL your step-by-step thinking:
- Parse the student's question intent
- Verify any math, physics constants, or chemistry formulas
- Plan your analogy and structure your explanation
- Check formatting (LaTeX, bullet points, headings)
This key is NEVER shown to the student. Write freely here.

### KEY 2 — clean_response (string)
This is the ONLY text the student will see. Rules:
- Start immediately with a warm, conversational, humanized response (no preamble, no "Constraint 1:", no "* User says...", no meta-tags)
- Use natural paragraphs, clean numbered lists, or beautifully spaced bullet points
- Wrap ALL equations, formulas, and chemical reactions in LaTeX: $...$ (inline) or $$...$$ (block)
- For definitions, provide: clear meaning + pronunciation guide if helpful + bridge to a real-world analogy
- For calculations, show clearly numbered steps with LaTeX math
- NEVER output internal reasoning, persona checks, system tags, or planning notes here

### KEY 3 — recommended_questions (array of strings)
Provide exactly 3 to 4 precise, contextually relevant follow-up study questions based on the current topic.
These will be rendered as clickable study pills for the student.
${documentBlock}${youtubeBlock}

## CHAT HISTORY:
${JSON.stringify(messages.slice(0, -1).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })))}

## STUDENT'S CURRENT MESSAGE:
${lastUserMessage}`;

    // JSON Response Schema — enforced at the API level
    const responseSchema = {
      type: "OBJECT",
      properties: {
        internal_reasoning: {
          type: "STRING",
          description:
            "Step-by-step AI thinking, persona checks, math verification, and constraint validation. NEVER shown to the user.",
        },
        clean_response: {
          type: "STRING",
          description:
            "The final, beautifully polished, warm tutoring response. Clean markdown and LaTeX only. No internal thought leaks.",
        },
        recommended_questions: {
          type: "ARRAY",
          items: { type: "STRING" },
          description:
            "Exactly 3 to 4 contextually relevant study questions for the student to explore next.",
        },
      },
      required: ["internal_reasoning", "clean_response", "recommended_questions"],
    };

    // Model preference list
    const modelCandidates = [
      "models/gemini-2.0-flash",
      "models/gemini-1.5-flash-latest",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
    ];

    let cleanResponse = "";
    let recommendedQuestions: string[] = [];
    let lastError = "Failed to communicate with Gemini AI API.";

    for (const modelName of modelCandidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPersona }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3000,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);

            // ✅ SERVER-SIDE FIREWALL: internal_reasoning is extracted and DISCARDED
            // Only clean_response and recommended_questions ever leave the server
            cleanResponse = (parsed.clean_response || "").trim();
            recommendedQuestions = Array.isArray(parsed.recommended_questions)
              ? parsed.recommended_questions.filter((q: string) => typeof q === "string" && q.trim())
              : [];

            if (cleanResponse) break;
          } catch (parseErr) {
            // Fallback: if JSON parse fails for any reason, use raw text as clean response
            // and strip any obvious meta-thought patterns
            cleanResponse = rawText
              .replace(/^[\s\S]*?"clean_response"\s*:\s*"/, "")
              .replace(/"[\s\S]*$/, "")
              .trim();
            if (cleanResponse) break;
          }
        }
      } else {
        lastError = data.error?.message || `Failed on ${modelName}`;
      }
    }

    if (!cleanResponse) {
      return NextResponse.json({ error: lastError }, { status: 500 });
    }

    // Build the recommended questions block appended to clean response
    const questionsBlock =
      recommendedQuestions.length > 0
        ? `\n\n### 💡 Recommended Next Questions\n${recommendedQuestions.map((q) => `- ${q}`).join("\n")}`
        : "";

    const finalClientPayload = `${cleanResponse}${questionsBlock}`;

    return NextResponse.json({
      role: "assistant",
      content: finalClientPayload,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error processing chat request." },
      { status: 500 }
    );
  }
}
