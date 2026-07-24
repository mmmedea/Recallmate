import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "Server Configuration Error: GEMINI_API_KEY is not set." }, { status: 500 });
    }

    const { text, fileName } = await req.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: "Not enough content extracted from this file." }, { status: 400 });
    }

    // 1. AUTO-DISCOVERY
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      return NextResponse.json({ error: "Invalid API Key or blocked access by Google." }, { status: 500 });
    }

    const validModels = (listData.models || []).filter((m: any) => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      !m.name.includes("2.5")
    );

    // 2. SPEED & STABILITY OPTIMIZATION
    // By requesting 2 questions per tier and shorter text, generation is 2x faster 
    // and easily fits inside the output limits of every model version.
    const prompt = `You are an expert study assistant reviewing material from "${fileName || "Uploaded File"}".
Extracted Content:
"""${text.slice(0, 12000)}"""

Instructions:
Return ONLY a raw JSON object. Do not wrap in markdown. Escape all quotation marks.

{
  "summary": "Concise 2 sentence overview.",
  "notes": ["Key point 1", "Key point 2", "Key point 3"],
  "questions": {
    "easy": [
      {
        "id": "e1",
        "question": "Question string?",
        "options": {
          "A": "Option 1",
          "B": "Option 2",
          "C": "Option 3",
          "D": "Option 4"
        },
        "correctAnswer": "A",
        "explanation": "Brief explanation.",
        "sourceCitation": "Short quote",
        "pageNumber": "1"
      }
    ],
    "medium": [],
    "hard": []
  }
}

Rules:
- Provide EXACTLY 2 questions per difficulty level (easy, medium, hard).
- Keep explanations and citations concise to ensure the response is fast.`;

    let rawText = "";
    let lastErrorMsg = "No valid models found for this API key.";

    // 3. LOOP
    for (const model of validModels) {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`;
      
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1 // Extremely low temp ensures strict formatting and no hallucinated breaking characters
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

    // 4. CLEAN & PARSE
    let parsedData;
    try {
      let cleanedText = rawText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      
      const firstBrace = cleanedText.indexOf("{");
      const lastBrace = cleanedText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.slice(firstBrace, lastBrace + 1);
      }

      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON Parsing Failed. Raw text was:", rawText);
      return NextResponse.json({ error: "The AI generated a malformed response or cut off early. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ fileName, ...parsedData });
  } catch (err: any) {
    console.error("Unhandled Error:", err);
    return NextResponse.json({ error: "Failed to generate study content." }, { status: 500 });
  }
}