import { TutorIntent, TutorToolName } from "./types";

export function selectToolPolicy(intent: TutorIntent): TutorToolName[] {
  const tools: TutorToolName[] = [];

  // If the router confidence is too low, disable complex tools to avoid hallucination loops
  if (intent.confidence < 0.5) {
    return tools;
  }

  if (intent.requiresTool) {
    if (["mathematics", "physics", "chemistry", "statistics", "engineering", "computer_science"].includes(intent.domain)) {
      if (intent.complexity !== "simple") {
        tools.push("symbolic_math");
        tools.push("code_execution"); // Gemini Native Code Execution (Python sandbox)
      }
      tools.push("calculator"); // Fallback deterministic calculator
    } else {
      tools.push("calculator"); // Fallback simple TS tool
    }
  }

  if (intent.domain === "physics" || intent.domain === "chemistry") {
    tools.push("unit_check"); // TS tool for deterministic unit checks
  }

  return tools;
}
