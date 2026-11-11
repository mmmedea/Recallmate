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

    // 1. AUTO-DISCOVERY: Fetch allowed models
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

    const prompt = `You are an expert study assistant reviewing material from "${fileName || "Uploaded File"}".
Extracted File Content:
"""${text.slice(0, 12000)}"""

Instructions:
Return ONLY a single raw JSON object matching the exact structure below. 
Escape all quotation marks properly inside strings.

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
- Provide exactly 3 multiple-choice questions for each difficulty level to ensure the response fits.
- Include exact quote/source text and page/section number.`;

    let rawText = "";
    let lastErrorMsg = "No valid models found for this API key.";

    // 2. LOOP: Test permitted models
    for (const model of validModels) {
      console.log(`Trying permitted model: ${model.name}`);
      
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
            maxOutputTokens: 8192, // CRITICAL: Gives the AI maximum space to finish the JSON
            temperature: 0.2       // CRITICAL: Forces strict formatting logic
          }
        }),
      });

      const aiData = await response.json();

      if (response.ok) {
        rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) {
          console.log(`Success! Extracted data using model: ${model.name}`);
          break;
        }
      } else {
        lastErrorMsg = aiData.error?.message || `Failed on ${model.name}`;
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: lastErrorMsg }, { status: 500 });
    }

    // 3. ULTRA-STRICT JSON PARSING
    let parsedData;
    try {
      // Strip markdown backticks completely
      let cleanedText = rawText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      
      // Physically slice everything outside the main JSON brackets
      const firstBrace = cleanedText.indexOf("{");
      const lastBrace = cleanedText.lastIndexOf("}");
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.slice(firstBrace, lastBrace + 1);
      }

      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON Parsing Failed. Raw text was:", rawText);
      return NextResponse.json({ 
        error: "The AI generated a malformed response or cut off early. Please try again." 
      }, { status: 500 });
    }

    return NextResponse.json({ fileName, ...parsedData });
  } catch (err: any) {
    console.error("Unhandled Error:", err);
    return NextResponse.json({ error: "Failed to generate study content." }, { status: 500 });
  }
}