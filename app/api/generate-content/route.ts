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

    const prompt = `You are an expert study assistant helping a student review material from a file named "${fileName}".
Content extracted from the file:
"""${text.slice(0, 15000)}"""

Return ONLY valid JSON, with no markdown fences and no extra commentary, matching exactly this shape:
{
  "summary": "a concise 3-5 sentence summary of the material",
  "notes": ["short bullet note", "short bullet note", "..."],
  "questions": {
    "easy": [{"question": "...", "answer": "..."}],
    "medium": [{"question": "...", "answer": "..."}],
    "hard": [{"question": "...", "answer": "..."}]
  }
}

Rules:
- Provide 5 questions per difficulty level.
- Questions must be short-answer active recall (not multiple choice).
- easy = recall of definitions and facts directly stated in the material.
- medium = explain relationships or apply a concept from the material.
- hard = analyze, compare, or apply the concept to a new scenario not explicitly in the text.
- Keep answers concise (1-3 sentences).`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text();

    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json({ fileName, ...data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate study content." }, { status: 500 });
  }
}