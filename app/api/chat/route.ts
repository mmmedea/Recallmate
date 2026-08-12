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

    const { messages, documentContext, mode = "tutor" } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }

    const systemInstruction = `You are Medea, the RecallMate AI Tutor, an elite AI assistant specialized in active recall study sessions.
Mode: ${mode.toUpperCase()}
${
  documentContext
    ? `Document Context:\n"""${documentContext.slice(0, 8000)}"""\n`
    : ""
}
Rules:
1. Ground your answers in the student's study material whenever available.
2. In 'TUTOR' mode, explain concepts step-by-step using clear analogies. Format all math and chemistry formulas in valid LaTeX (e.g. \\( E=mc^2 \\) or \\[ \\frac{a}{b} \\]).
3. In 'DICTIONARY' mode, provide concise technical definitions, key terms, and examples.
4. Keep your tone encouraging, concise, and academically precise.`;

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

    return NextResponse.json({
      role: "assistant",
      content: replyText,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error processing chat request." },
      { status: 500 }
    );
  }
}
