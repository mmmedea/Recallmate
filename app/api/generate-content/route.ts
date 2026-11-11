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
      return NextResponse.json({ error: "Not enough content extracted from this file." }, { status: 400 });
    }

    // 1. AUTO-DISCOVERY: Fetch exactly what this API key is allowed to use
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      console.error("API Key Verification Failed:", listData);
      return NextResponse.json({ error: "Invalid API Key or blocked access by Google." }, { status: 500 });
    }

    // 2. Filter out unsupported models AND specifically block the restricted "2.5" versions
    const validModels = (listData.models || []).filter((m: any) => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      !m.name.includes("2.5") // Skips models we know Google blocks for new users
    );

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
    let lastErrorMsg = "No valid models found for this API key.";

    // 3. LOOP: Test the actual permitted models one by one until success
    for (const model of validModels) {
      console.log(`Trying permitted model: ${model.name}`);
      
      // model.name comes directly from Google (e.g., "models/gemini-1.5-flash")
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`;
      
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
          console.log(`Success! Extracted data using model: ${model.name}`);
          break; // Stop looping! We got the notes.
        }
      } else {
        console.warn(`Model ${model.name} failed:`, aiData.error?.message);
        lastErrorMsg = aiData.error?.message || `Failed on ${model.name}`;
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: lastErrorMsg }, { status: 500 });
    }

    // 4. Safely parse the JSON output
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