import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// In-memory rate limiter map (IP -> timestamp)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window

// Guardrail: Jailbreak & Prompt Injection Blacklist Patterns
const DANGEROUS_PATTERNS = [
  "ignore previous instructions",
  "disregard all previous rules",
  "system prompt",
  "you are now unrestricted",
  "jailbreak",
  "bypass safety"
];

function applyInputGuardrails(text: string): { safe: boolean; reason?: string } {
  if (!text || text.trim().length < 10) {
    return { safe: false, reason: "Extracted content is too short for processing." };
  }

  const lowerText = text.toLowerCase();
  for (const pattern of DANGEROUS_PATTERNS) {
    if (lowerText.includes(pattern)) {
      return { safe: false, reason: "Security violation: Potential prompt injection or jailbreak attempt detected." };
    }
  }

  return { safe: true };
}

export async function POST(req: NextRequest) {
  try {
    // 1. RATE LIMITING RAIL
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const now = Date.now();
    const lastRequestTime = rateLimitMap.get(ip) || 0;

    if (now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastRequestTime)) / 1000);
      return NextResponse.json(
        { error: `Rate limit reached. Please wait ${waitSeconds} seconds before generating another session.` },
        { status: 429 }
      );
    }
    rateLimitMap.set(ip, now);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server Configuration Error: GEMINI_API_KEY is not set." }, { status: 500 });
    }

    const { text, fileName, count = 10, difficulty = "easy", isPremium = false } = await req.json();

    // 2. INPUT RAIL VALIDATION
    const inputValidation = applyInputGuardrails(text);
    if (!inputValidation.safe) {
      return NextResponse.json({ error: inputValidation.reason }, { status: 400 });
    }

    // Enforce strict question limits based on premium status
    const maxAllowed = isPremium ? 50 : 30;
    const requestedCount = Math.min(Math.max(Number(count) || 10, 5), maxAllowed);

    // AUTO-DISCOVERY of valid models
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      return NextResponse.json({ error: "Invalid API Key or blocked access by Google." }, { status: 500 });
    }

    let validModels = (listData.models || []).filter((m: any) => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      !m.name.includes("preview") &&
      !m.name.includes("robotics") &&
      !m.name.includes("vision") &&
      !m.name.includes("2.5") &&
      !m.name.includes("2.0")
    );

    if (validModels.length === 0) {
      return NextResponse.json({ error: "No compatible models found for this API key." }, { status: 500 });
    }

    validModels.sort((a: any, b: any) => {
      const aScore = (a.name.includes("flash") ? 2 : 0) + (a.name.includes("1.5") ? 1 : 0);
      const bScore = (b.name.includes("flash") ? 2 : 0) + (b.name.includes("1.5") ? 1 : 0);
      return bScore - aScore;
    });

    // 3. SECURE PROMPT RAIL (Enforcing strict schema & hard-mode constraints)
    const prompt = `Review the material from "${fileName || "Uploaded Files"}".
Extracted Content:
"""${text.slice(0, 12000)}"""

Instructions:
1. Generate detailed, comprehensive notes that are extremely easy for students to understand. Include clear explanations and practical examples derived STRICTLY from the file content.
2. Generate exactly ${requestedCount} multiple-choice questions at the "${difficulty}" difficulty level.

IMPORTANT RULES FOR QUESTIONS:
- If difficulty is "hard", DO NOT ask simple recall or definition questions. Make the questions significantly harder by turning them into complex scenario-based, analytical, or multi-step logic problems that require critical thinking to solve.
- Return a SINGLE valid JSON object. Do not wrap in markdown or backticks.

{
  "summary": "Concise 2 sentence overview.",
  "notes": [
    "Detailed note 1 with a clear explanation and example.",
    "Detailed note 2 with a clear explanation and example."
  ],
  "questions": [
    {
      "id": "q1",
      "question": "Scenario or logic-based question string?",
      "options": {
        "A": "Option 1",
        "B": "Option 2",
        "C": "Option 3",
        "D": "Option 4"
      },
      "correctAnswer": "A",
      "explanation": "Detailed breakdown explaining why this choice is correct through logical reasoning.",
      "sourceCitation": "Short quote from text",
      "pageNumber": "1"
    }
  ]
}

Rules:
- Generate ALL ${requestedCount} questions under the "questions" array.
- All questions must match the "${difficulty}" difficulty level.
- Escape all double quotes inside strings properly.`;

    let rawText = "";
    let lastErrorMsg = "All attempted models failed.";

    for (const model of validModels) {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`;
      
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        }),
      });

      const aiData = await response.json();

      if (response.ok) {
        rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawText) break;
      } else {
        lastErrorMsg = aiData.error?.message || `Failed on ${model.name}`;
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: lastErrorMsg }, { status: 500 });
    }

    // 4. OUTPUT RAIL VALIDATION (Strict Schema Parsing)
    try {
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON braces found in model response.");
      }

      const cleanJson = rawText.substring(firstBrace, lastBrace + 1);
      const parsedData = JSON.parse(cleanJson);

      // Verify required keys exist
      if (!parsedData.summary || !parsedData.notes || !parsedData.questions) {
        throw new Error("Output failed schema validation check.");
      }

      return NextResponse.json({ fileName, difficulty, ...parsedData });
    } catch (parseErr) {
      return NextResponse.json({ error: "The AI generated a malformed response. Please try again." }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate study content safely." }, { status: 500 });
  }
}