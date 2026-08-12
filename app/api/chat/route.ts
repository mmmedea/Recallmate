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

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const ytMatch = lastUserMessage.match(ytRegex);

    let youtubeContextPrompt = "";
    if (ytMatch) {
      const videoId = ytMatch[1];
      youtubeContextPrompt = `
NOTE: The user shared a YouTube video link (ID: ${videoId}).
Your task:
1. Summarize the video clearly in 2-3 well-structured paragraphs.
2. Provide 3-5 bullet points of the most critical takeaways.
3. Do NOT include any meta-thoughts, system tags, or planning notes.
4. End your response by inviting the student to ask specific questions about the video content.
`;
    }

    const systemInstruction = isFeynmanEvaluation
      ? `You are Medea, evaluating a student's explanation using the Feynman Technique.
Rate clarity and semantic accuracy from 1 to 3 hearts. End with EXACT JSON: {"heartsEarned": 1|2|3}`
      : `You are Medea, the brilliant, friendly, and highly encouraging AI Tutor for RecallMate.
Your goal is to make complicated subjects (physics, math, chemistry, history, geometry, and science) incredibly easy to understand using vivid, real-world analogies and concrete examples.

### CONSTRAINTS:
1. NO INTERNAL REASONING: Never output any internal reasoning, planning tags, mental checks, or meta-thoughts. Start your response directly with your warm, conversational greeting or explanation.
2. CLEAN FORMATTING ONLY: Write in natural, humanized paragraphs, clean numbered lists, or beautifully spaced bullet points. Never print raw markdown syntax (such as stray #, *, or _) in a way that clutters the screen. 
3. LATEX MATH: Always wrap mathematical equations, physical formulas, and chemical symbols in standard LaTeX ($...$ for inline, $$...$$ for block) so the frontend KaTeX renderer displays them flawlessly.
4. DYNAMIC EXAMPLES & ANALOGIES: When explaining a concept, always include a clear example or everyday analogy to build intuition.
5. NO WIKIPEDIA / HIGH ACCURACY: Rely strictly on the verified academic search results or uploaded documents provided in your context. If you are unsure of a fact, explain what is verified and offer to help guide their focus.
6. RECOMMENDED NEXT QUESTIONS: At the VERY END of your response, provide 3-4 contextually relevant follow-up questions under the exact header:
### 💡 Recommended Next Questions
- [First recommended question]?
- [Second recommended question]?
- [Third recommended question]?

${documentContext ? `Document/Lecture Context:\n"""${documentContext.slice(0, 8000)}"""\n` : ""}
${youtubeContextPrompt}`;

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

    // Robust Sanitizer: Extract pure conversational response and strip all internal reflection tags
    let cleanText = replyText;

    // Check if output contains section markers or internal reflection lists
    const greetingMatch = cleanText.match(/(?:\+\s*Greeting\s*\+\*?|###\s*Greeting)?\s*["']?([I|Hi|Hello|Welcome|Let's|Sure|Imagine|The|Since][\s\S]*)/i);
    if (greetingMatch && greetingMatch[1] && greetingMatch[1].length > 30) {
      cleanText = greetingMatch[1];
    }

    cleanText = cleanText
      .replace(/^\s*\*\s*(Since|Wait|Actually|Self-Correction|Plan|Analogy|simple terms|Nucleus|Electrons|Energy|Friendly|Clear|Analogies|Concrete|LaTeX|No meta|Recommended|Greeting|Explanation|Example|Next Questions|\+).*$/gim, "")
      .replace(/\*\s*\+\s*(Greeting|Explanation|Example|Next Questions|Self-Correction|Plan|Analogy)\s*\+\s*\*/gi, "")
      .replace(/\+\s*(Greeting|Explanation|Example|Next Questions|Self-Correction|Plan|Analogy)\s*\+/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

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
