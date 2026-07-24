import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("SERVER ERROR: GEMINI_API_KEY is missing.");
      return NextResponse.json({ error: "Server Configuration Error: GEMINI_API_KEY is not set." }, { status: 500 });
    }

    const { text, fileName } = await req.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: "Not enough content extracted from this file to generate notes." }, { status: 400 });
    }

    // 1. AUTO-DISCOVERY: Ask Google what models you are actually allowed to use
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      console.error("API Key Verification Failed:", listData);
      return NextResponse.json({ error: "Invalid API Key or blocked access by Google." }, { status: 500 });
    }

    // 2. Filter for valid text-generation models and select the best one available
    const models = listData.models || [];
    const validModels = models.filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"));
    
    const selectedModel = validModels.find((m: any) => m.name.includes("flash")) 
                       || validModels.find((m: any) => m.name.includes("pro")) 
                       || validModels[0];

    if (!selectedModel) {
      return NextResponse.json({ error: "No compatible text generation models found on your API key." }, { status: 500 });
    }

    console.log(`Auto-selected model: ${selectedModel.name}`);

    // 3. Build the prompt
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
        "explanation": "Detailed explanation.",
        "sourceCitation": "Exact quote",
        "pageNumber": "Page 1"
      }
    ],
    "medium": [],
    "hard": []
  }
}

Rules:
- Provide 4 multiple-choice questions for each difficulty level (easy, medium, hard).
- Include exact quote/source text and page/section number.`;

    // 4. Generate content using the exact model string provided by Google
    // Note: selectedModel.name already includes the "models/" prefix (e.g., "models/gemini-1.5-flash")
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;
    
    const response = await fetch(generateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      }),
    });

    const aiData = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", aiData);
      return NextResponse.json({ error: aiData.error?.message || "Google API rejected the request." }, { status: 500 });
    }

    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      return NextResponse.json({ error: "AI service returned an empty response." }, { status: 500 });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(rawText.trim());
    } catch (parseErr) {
      console.error("JSON Parsing Failed:", rawText);
      return NextResponse.json({ error: "Failed to parse structured study content." }, { status: 500 });
    }

    return NextResponse.json({ fileName, ...parsedData });
  } catch (err: any) {
    console.error("Unhandled Error:", err);
    return NextResponse.json({ error: "Failed to generate study content." }, { status: 500 });
  }
}