import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple in-memory rate limiter map (IP -> timestamp)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window

export async function POST(req: NextRequest) {
  try {
    // 1. RATE LIMITING FOR SAFETY
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const now = Date.now();
    const lastRequestTime = rateLimitMap.get(ip) || 0;

    if (now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastRequestTime)) / 1000);
      return NextResponse.json(
        { error: `Rate limit reached. Please wait ${waitSeconds} seconds before generating another quiz.` },
        { status: 429 }
      );
    }
    rateLimitMap.set(ip, now);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server Configuration Error: GEMINI_API_KEY is not set." }, { status: 500 });
    }

    const { text, fileName, count = 10, difficulty = "easy", isPremium = false } = await req.json();

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: "Not enough content extracted from this file." }, { status: 400 });
    }

    // Enforce strict question limits based on premium status
    const maxAllowed = isPremium ? 50 : 30;
    const requestedCount = Math.min(Math.max(Number(count) || 10, 5), maxAllowed);

    // AUTO-DISCOVERY of valid models
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      return NextResponse.json({ error: "Invalid API Key or blocked access by Google." }, { status: 500 });
    }

    let validModels = (listData.models || []).filter((m: any) => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      !m.name.includes("preview") &&
      !m.name.includes("robotics") &&
      !m.name.includes("vision") &&
      !m.name.includes("2.5") &&
      !m.name.includes("2.0")
    );

    if (validModels.length === 0) {
      return NextResponse.json({ error: "No compatible models found for this API key." }, { status: 500 });
    }

    validModels.sort((a: any, b: any) => {
      const aScore = (a.name.includes("flash") ? 2 : 0) + (a.name.includes("1.5") ? 1 : 0);
      const bScore = (b.name.includes("flash") ? 2 : 0) + (b.name.includes("1.5") ? 1 : 0);
      return bScore - aScore;
    });

    // PROMPT tailored to user's exact difficulty and count choices
    const prompt = `Review the material from "${fileName || "Uploaded Files"}".
Extracted Content:
"""${text.slice(0, 12000)}"""

Instructions:
Generate exactly ${requestedCount} multiple-choice questions specifically at the "${difficulty}" difficulty level.
Return a SINGLE valid JSON object. Do not wrap in markdown or backticks.

{
  "summary": "Concise 2 sentence overview.",
  "notes": ["Key point 1", "Key point 2"],
  "questions": [
    {
      "id": "q1",
      "question": "Question string?",
      "options": {
        "A": "Option 1",
        "B": "Option 2",
        "C": "Option 3",
        "D": "Option 4"
      },
      "correctAnswer": "A",
      "explanation": "Detailed explanation.",
      "sourceCitation": "Short quote",
      "pageNumber": "1"
    }
  ]
}

Rules:
- Generate ALL ${requestedCount} questions under the "questions" array.
- All questions must match the "${difficulty}" difficulty level.
- Escape all double quotes inside strings properly.`;

    let rawText = "";
    let lastErrorMsg = "All attempted models failed.";

    for (const model of validModels) {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`;
      
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        }),
      });

      const aiData = await response.json();

      if (response.ok) {
        rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) break;
      } else {
        lastErrorMsg = aiData.error?.message || `Failed on ${model.name}`;
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: lastErrorMsg }, { status: 500 });
    }

    try {
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON braces found.");
      }

      const cleanJson = rawText.substring(firstBrace, lastBrace + 1);
      const parsedData = JSON.parse(cleanJson);

      return NextResponse.json({ fileName, difficulty, ...parsedData });
    } catch (parseErr) {
      return NextResponse.json({ error: "The AI generated a malformed response. Please try again." }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate study content." }, { status: 500 });
  }
}