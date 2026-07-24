import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// A curated list of stable, universally accessible model versions.
const CANDIDATE_MODELS = [
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-001",
  "gemini-1.5-pro-002",
  "gemini-1.5-pro-001",
  "gemini-pro"
];

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

    let rawText = "";
    let lastErrorMsg = "All model candidates failed.";

    // Iterate through the known stable models until one successfully generates content
    for (const model of CANDIDATE_MODELS) {
      console.log(`Attempting to generate with model: ${model}`);
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
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

      if (response.ok) {
        rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) {
          console.log(`Success! Used model: ${model}`);
          break; // Exit the loop on success
        }
      } else {
        console.warn(`Model ${model} failed with error:`, aiData.error?.message);
        lastErrorMsg = aiData.error?.message || `Failed on model ${model}`;
      }
    }

    // If the loop finished and rawText is still empty, throw the last error we received
    if (!rawText) {
      return NextResponse.json({ error: lastErrorMsg }, { status: 500 });
    }

    // Safely parse the JSON output
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