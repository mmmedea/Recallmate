import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: NextRequest) {
  try {
    // 1. Guard check for missing API key
    if (!apiKey) {
      console.error("SERVER ERROR: GEMINI_API_KEY environment variable is missing.");
      return NextResponse.json(
        { error: "Server Configuration Error: GEMINI_API_KEY is not set in Vercel." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { text, fileName } = body;

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Not enough content extracted from this file to generate notes." },
        { status: 400 }
      );
    }

    const prompt = `You are an expert study assistant reviewing material from "${fileName || "Uploaded File"}".
Extracted File Content:
"""${text.slice(0, 20000)}"""

Instructions:
1. Focus STRICTLY on the facts presented in the uploaded file text above. Do NOT include outside knowledge or unreferenced facts.
2. Return ONLY a single raw JSON object matching the exact structure below (no markdown formatting, no code fences).

JSON Structure required:
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

    // 2. Call Gemini using the modern @google/genai SDK
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const rawText = response.text || "";

    if (!rawText) {
      return NextResponse.json(
        { error: "AI service returned an empty response. Please try again." },
        { status: 500 }
      );
    }

    // 3. Extract and parse JSON output safely
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const cleanedJsonString = jsonMatch ? jsonMatch[0] : rawText.trim();

    let data;
    try {
      data = JSON.parse(cleanedJsonString);
    } catch (parseErr) {
      console.error("JSON Parsing Failed. Raw text received from AI:", rawText);
      return NextResponse.json(
        { error: "Failed to parse structured study content from AI response." },
        { status: 500 }
      );
    }

    return NextResponse.json({ fileName, ...data });
  } catch (err: any) {
    console.error("Unhandled Error in /api/generate-content:", err?.stack || err);
    return NextResponse.json(
      { error: "Failed to generate study content. Please try again." },
      { status: 500 }
    );
  }
}