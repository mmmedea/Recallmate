import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // 1. Guard check for missing API Key
    if (!apiKey) {
      console.error("SERVER ERROR: GEMINI_API_KEY is missing.");
      return NextResponse.json(
        { error: "Server Configuration Error: GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const { text, fileName } = await req.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Not enough content extracted from this file to generate notes." },
        { status: 400 }
      );
    }

    const prompt = `You are an expert study assistant reviewing material from "${fileName || "Uploaded File"}".
Extracted File Content:
"""${text.slice(0, 15000)}"""

Instructions:
Return ONLY a single raw JSON object matching the exact structure below. Do NOT wrap it in markdown blockquotes.

{
  "summary": "Concise 3-5 sentence overview of the file.",
  "notes": ["bullet point 1", "bullet point 2"],
  "questions": {
    "easy": [
      {
        "id": "e1",
        "question": "Question string?",
        "options": {
          "A": "Option text 1",
          "B": "Option text 2",
          "C": "Option text 3",
          "D": "Option text 4"
        },
        "correctAnswer": "A",
        "explanation": "Detailed explanation of why this answer is correct based on the file.",
        "sourceCitation": "Exact sentence or paragraph quoted from the file",
        "pageNumber": "Page 1 or Section 1"
      }
    ],
    "medium": [],
    "hard": []
  }
}

Rules:
- Provide 4 multiple-choice questions for each difficulty level (easy, medium, hard).
- Options must be labeled A, B, C, and D.
- Include exact quote/source text and page/section number for "sourceCitation" and "pageNumber".`;

    // 2. Direct REST API Call (Bypasses SDK issues)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json", // Forces strict JSON output
        }
      }),
    });

    const aiData = await response.json();

    // 3. Catch API-level errors (like invalid keys or quotas)
    if (!response.ok) {
      console.error("Gemini API Error:", aiData);
      return NextResponse.json(
        { error: aiData.error?.message || "Google API rejected the request." },
        { status: 500 }
      );
    }

    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      return NextResponse.json(
        { error: "AI service returned an empty response." },
        { status: 500 }
      );
    }

    // 4. Safe JSON Parsing
    let parsedData;
    try {
      parsedData = JSON.parse(rawText.trim());
    } catch (parseErr) {
      console.error("JSON Parsing Failed. Raw text received from AI:", rawText);
      return NextResponse.json(
        { error: "Failed to parse structured study content from AI response." },
        { status: 500 }
      );
    }

    return NextResponse.json({ fileName, ...parsedData });
  } catch (err: any) {
    console.error("Unhandled Error in /api/generate-content:", err?.stack || err);
    return NextResponse.json(
      { error: "Failed to generate study content. Please try again." },
      { status: 500 }
    );
  }
}