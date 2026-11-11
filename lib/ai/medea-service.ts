import { generateText } from "ai";

const MEDEA_GATEWAY_MODEL = "google/gemini-3.7-flash";

export type MedeaGenerationRequest = {
  system: string;
  prompt: string;
  question?: string;
  userId: string;
};

export function solveSafeArithmetic(prompt: string) {
  const expression = prompt.trim().replace(/^(what is|calculate|solve)\s+/i, "").replace(/\?$/, "").trim();
  const allowed = "0123456789 +-*/().%^\t\n";
  if (!expression || expression.length > 100 || ![...expression].every((character) => allowed.includes(character))) return null;
  try {
    const result = Function(`"use strict"; return (${expression.replace(/\^/g, "**")})`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return `**${expression} = ${result}**\n\nWorking: evaluate multiplication and division first, then addition and subtraction.`;
  } catch {
    return null;
  }
}

export function shouldGroundWithGoogleSearch(question: string) {
  return /\b(today|current|currently|latest|recent|news|weather|price|score|schedule|this week|this month|this year|who is the|as of)\b/i.test(question);
}

export async function generateMedeaReply(request: MedeaGenerationRequest) {
  const { system, prompt, userId } = request;
  const deterministic = solveSafeArithmetic(request.question || prompt);
  if (deterministic) return deterministic;

  if (process.env.GEMINI_API_KEY) {
    try {
      const { ProviderAdapter } = await import("./provider");
      const directRequest = {
        operation: "chat",
        systemInstruction: system,
        prompt,
      } as const;
      let direct;
      if (shouldGroundWithGoogleSearch(request.question || prompt)) {
        try {
          direct = await ProviderAdapter.generate({ ...directRequest, tools: [{ type: "google_search" }] });
        } catch (searchError) {
          console.warn("Medea Google Search grounding failed; retrying without grounding.", searchError);
          direct = await ProviderAdapter.generate(directRequest);
        }
      } else {
        direct = await ProviderAdapter.generate(directRequest);
      }
      if (direct.text.trim()) return direct.text;
    } catch (directError) {
      console.warn("Medea direct Gemini request failed; trying AI Gateway.", directError);
    }
  }

  try {
    const result = await generateText({
      model: MEDEA_GATEWAY_MODEL,
      system,
      prompt,
      providerOptions: {
        gateway: { user: userId, tags: ["feature:medea", "surface:study-drawer"] },
      },
    });
    if (!result.text.trim()) throw new Error("Medea returned an empty response");
    return result.text;
  } catch (gatewayError) {
    throw gatewayError;
  }
}
