import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "Server Configuration Error: GEMINI_API_KEY is not set." }, { status: 500 });
    }

    const { text, fileName } = await req.json();

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: "Not enough content extracted from this file." }, { status: 400 });
    }

    // 1. AUTO-DISCOVERY: Safely find available models
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      return NextResponse.json({ error: "Invalid API Key or blocked access by Google." }, { status: 500 });
    }

    // 2. SMART FILTER: Keep only models that can generate text, and block known problematic ones
    let validModels = (listData.models || []).filter((m: any) => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      !m.name.includes("preview") &&
      !m.name.includes("robotics") &&
      !m.name.includes("vision") &&
      !m.name.includes("2.5") // Block 2.5 to avoid the "new user" error
    );

    if (validModels.length === 0) {
      return NextResponse.json({ error: "Your API key does not have access to any compatible text generation models." }, { status: 500 });
    }

    // Sort to prioritize "flash" models, then "1.5" versions
    validModels.sort((a: any, b: any) => {
      const aScore = (a.name.includes("flash") ? 2 : 0) + (a.name.includes("1.5") ? 1 : 0);
      const bScore = (b.name.includes("flash") ? 2 : 0) + (b.name.includes("1.5") ? 1 : 0);
      return bScore - aScore;
    });

    // We take the top model exactly as Google named it. ZERO hardcoded guessing.
    const selectedModel = validModels[0].name;
    console.log(`Successfully auto-selected model: ${selectedModel}`);

    // 3. ULTRA-LEAN PROMPT
    const prompt = `Review the material from "${fileName || "Uploaded Files"}".
Extracted Content:
"""${text.slice(0, 10000)}"""

Return a SINGLE valid JSON object. Do not wrap in markdown or backticks. Do not include any conversational text.

{
  "summary": "Concise 2 sentence overview.",
  "notes": ["Key point 1", "Key point 2"],
  "questions": {
    "easy": [
      {
        "id": "e1",
        "question": "Easy question?",
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
    "medium": [
      {
        "id": "m1",
        "question": "Medium question?",
        "options": { "A": "1", "B": "2", "C": "3", "D": "4" },
        "correctAnswer": "A",
        "explanation": "Brief explanation.",
        "sourceCitation": "Short quote",
        "pageNumber": "1"
      }
    ],
    "hard": [
      {
        "id": "h1",
        "question": "Hard question?",
        "options": { "A": "1", "B": "2", "C": "3", "D": "4" },
        "correctAnswer": "A",
        "explanation": "Brief explanation.",
        "sourceCitation": "Short quote",
        "pageNumber": "1"
      }
    ]
  }
}

Rules:
- Provide EXACTLY 1 question per difficulty level. Do not provide more.
- Escape all double quotes inside strings properly.`;

    // 4. GENERATION
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`;
    
    const response = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      }),
    });

    const aiData = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: aiData.error?.message || "Google API Error" }, { status: 500 });
    }

    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      return NextResponse.json({ error: "AI returned an empty response." }, { status: 500 });
    }

    // 5. BULLETPROOF PARSING
    try {
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON braces found in the output.");
      }

      const cleanJson = rawText.substring(firstBrace, lastBrace + 1);
      const parsedData = JSON.parse(cleanJson);

      return NextResponse.json({ fileName, ...parsedData });
    } catch (parseErr) {
      console.error("JSON Parsing Failed. Raw text was:", rawText);
      return NextResponse.json({ 
        error: "The AI generated a malformed response or cut off early. Please try again." 
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Unhandled Error:", err);
    return NextResponse.json({ error: "Failed to generate study content." }, { status: 500 });
  }
}