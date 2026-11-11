import { ProviderAdapter } from "../provider";
import { TutorIntent } from "./types";

const TutorIntentJsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "document_qa", "explain", "math_calculation", "physics_problem",
        "chemistry_problem", "hint", "socratic", "check_work",
        "summarize", "compare", "debug", "quiz"
      ]
    },
    domain: {
      type: "string",
      enum: [
        "mathematics", "physics", "chemistry", "biology",
        "computer_science", "engineering", "statistics",
        "history", "literature", "language", "general_academic"
      ]
    },
    complexity: {
      type: "string",
      enum: ["simple", "moderate", "complex"]
    },
    requiresTool: { type: "boolean" },
    requiresVerification: { type: "boolean" },
    confidence: { type: "number" }
  },
  required: [
    "intent", "domain", "complexity", 
    "requiresTool", "requiresVerification", "confidence"
  ]
};

export async function detectTutorIntent(
  userMessage: string,
  documentTitle: string = "Unknown Document",
  conversationHistorySummary: string = ""
): Promise<TutorIntent> {
  const systemInstruction = `You are the Medea Intent Router. Your job is to classify the student's message into a structured learning intent.
Analyze the user's message, considering the document title and recent conversation history.

RULES:
1. Identify the learning intent (e.g., explain, math_calculation, physics_problem, chemistry_problem, hint, quiz).
2. Identify the domain (mathematics, physics, etc.). Do not rely solely on the document title. If the document is "Week 4" but the question is "Solve this integral", the domain is mathematics.
3. Identify the problem complexity (simple, moderate, complex).
4. Decide if it requiresTool (for math/physics calculation) and requiresVerification (for calculation checking or correctness checking).

Output strictly valid JSON matching the schema.`;

  const prompt = `DOCUMENT TITLE: ${documentTitle}
RECENT HISTORY: ${conversationHistorySummary}
USER MESSAGE: ${userMessage}

Determine the intent.`;

  const response = await ProviderAdapter.generate({
    operation: "fast", // Fast operation defined in ModelRegistry
    systemInstruction,
    prompt,
    responseSchema: TutorIntentJsonSchema
  });

  return JSON.parse(response.text) as TutorIntent;
}
