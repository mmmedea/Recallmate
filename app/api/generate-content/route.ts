import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Model fallback candidate list
const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gemini-pro"
];

export async function POST(req: NextRequest) {
  try {
    // 1. Guard check for missing API Key
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
"""${text.slice(0, 18000)}"""

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

    let rawText = "";
    let lastError: any = null;

    // 2. Fallback loop across available models
    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`Attempting generation with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
        if (rawText && rawText.length > 0) {
          console.log(`Successfully generated content using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Model candidate ${modelName} failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!rawText) {
      console.error("All Gemini model candidates failed. Last error:", lastError);
      return NextResponse.json(
        { error: "AI service failed to generate content. Please check model permissions." },
        { status: 500 }
      );
    }

    // 3. Robust JSON Extraction Cleaning
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