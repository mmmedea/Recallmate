import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Stateful Streaming Omni-Assistant Chat Route
 * Provides real-time interactive tutoring, dictionary definitions, and Socratic questioning.
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

    const { messages, documentContext, mode = "tutor", isFeynmanEvaluation = false } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }

    const systemInstruction = isFeynmanEvaluation
      ? `You are Medea, evaluating a student's explanation using the Feynman Technique.
Your goal: Read the student's explanation of a concept.
Rules:
1. Rate their clarity and semantic accuracy from 1 to 3 hearts:
   - 3 Hearts: Outstanding, accurate, easy-to-understand explanation with analogies.
   - 2 Hearts: Good attempt, mostly correct with minor omissions.
   - 1 Heart: Basic attempt, needs clarification.
2. Provide a 2-sentence encouraging review.
3. End your output with EXACT JSON at the bottom: {"heartsEarned": 1|2|3}`
      : `You are Medea, an exceptionally friendly, clear, and engaging AI Tutor for RecallMate.
Current Mode: ${mode.toUpperCase()}
${
  documentContext
    ? `Student's Study Document Context:\n"""${documentContext.slice(0, 8000)}"""\n`
    : ""
}
RESPONSE STRUCTURE & RULES (STRICT):
1. ABSOLUTELY NO INTERNAL REASONING OR META-THOUGHTS: Output ONLY your final response directly to the student. DO NOT output rule checklists, thought process text, or self-evaluations (e.g. NEVER output "* User asks..." or "* Persona: Medea...").
2. EXTREMELY EASY TO UNDERSTAND: Break down every concept into simple, plain language. Use relatable, real-world analogies so anyone can grasp it easily.
3. CONCRETE EXAMPLES: Provide clear, practical examples for every explanation.
4. MATH & SCIENCE FORMULAS: Format mathematical equations or chemical reactions in valid inline LaTeX \\( ... \\) or block LaTeX \\[ ... \\].
5. SCHOLARLY RAG & SEARCH RESTRICTION: Ground all facts strictly in verified academic sources (.edu, .gov, .org, arXiv, PubMed) and user documents. Strictly NEVER cite Wikipedia or unverified wikis.
6. PREDICTIVE FOLLOW-UP QUESTIONS: At the VERY END of every response, predict what the student will want to understand next to master the topic. Provide 3 recommended questions under the exact header below:

### 💡 Recommended Next Questions
- [First follow-up question]?
- [Second follow-up question]?
- [Third follow-up question]?`;

    // Construct Gemini contents array
    const contents = [
      { parts: [{ text: systemInstruction }] },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    ];

    // AUTO-DISCOVERY of valid Gemini models
    let validModelNames: string[] = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json();
        const models = (listData.models || []).filter(
          (m: any) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            !m.name.includes("preview") &&
            !m.name.includes("robotics")
        );
        validModelNames = models.map((m: any) => m.name);
      }
    } catch (e) {
      console.warn("Model listing failed, using fallback candidate list.");
    }

    if (validModelNames.length === 0) {
      validModelNames = [
        "models/gemini-1.5-flash-latest",
        "models/gemini-1.5-flash",
        "models/gemini-2.0-flash",
        "models/gemini-1.5-pro",
        "models/gemini-pro",
      ];
    }

    let replyText = "";
    let lastErrorMsg = "Failed to communicate with Gemini AI API.";

    for (const modelName of validModelNames) {
      const cleanModelPath = modelName.startsWith("models/") ? modelName : `models/${modelName}`;
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${cleanModelPath}:generateContent?key=${apiKey}`;

      const aiRes = await fetch(generateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          },
        }),
      });

      const aiData = await aiRes.json();

      if (aiRes.ok) {
        replyText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (replyText) break;
      } else {
        lastErrorMsg = aiData.error?.message || `Failed on ${cleanModelPath}`;
      }
    }

    if (!replyText) {
      return NextResponse.json({ error: lastErrorMsg }, { status: 500 });
    }

    // Sanitize any accidental meta-reasoning text
    let cleanText = replyText.replace(/(\* User asks:[\s\S]*?(Wait|That's|So|Let's|The Analogy))/gi, "$2").trim();
    cleanText = cleanText.replace(/\* Persona:[\s\S]*?\n\n/gi, "").trim();
    cleanText = cleanText.replace(/\* Rule \d+:[\s\S]*?\n\n/gi, "").trim();

    return NextResponse.json({
      role: "assistant",
      content: cleanText || replyText,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error processing chat request." },
      { status: 500 }
    );
  }
}
