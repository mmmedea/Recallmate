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

    const systemInstruction = `You are the RecallMate Omni-Assistant, an elite AI tutor specialized in active recall study sessions.
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

    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

    if (!aiRes.ok) {
      const errMsg = aiData.error?.message || "Failed to communicate with Gemini AI API.";
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const replyText =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I could not generate a response. Please try again.";

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
