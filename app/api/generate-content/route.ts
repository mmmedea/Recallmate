import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { text, fileName } = await req.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Not enough content extracted from this file to generate notes." },
        { status: 400 }
      );
    }

    const prompt = `You are an expert study assistant reviewing material from "${fileName}".
Extracted File Content:
"""${text.slice(0, 20000)}"""

Instructions:
1. Focus STRICTLY on the facts and information presented in the uploaded file text above. Do NOT include outside knowledge or unreferenced facts.
2. Return ONLY a single raw JSON object (NO markdown backticks, NO \`\`\`json fences).

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
        "pageNumber": "Page 1 or Section 1.2"
      }
    ],
    "medium": [],
    "hard": []
  }
}

Rules:
- Provide 4 multiple-choice questions for each difficulty level (easy, medium, hard).
- Provide options labeled A, B, C, and D.
- Include the exact quote/source text and estimated page/section from the uploaded file for "sourceCitation" and "pageNumber".`;

    // Using stable Gemini model endpoint
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text();

    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json({ fileName, ...data });
  } catch (err) {
    console.error("Gemini API Error:", err);
    return NextResponse.json(
      { error: "Failed to generate study content. Please try again." },
      { status: 500 }
    );
  }
}