import { TutorIntent, ReasoningLevel } from "./types";

export function selectReasoningPolicy(intent: TutorIntent): ReasoningLevel {
  // Safe fallback if confidence is low
  if (intent.confidence < 0.6) {
    return "medium";
  }

  // Domain-specific high reasoning
  if (["mathematics", "physics", "chemistry", "computer_science"].includes(intent.domain)) {
    if (["math_calculation", "physics_problem", "chemistry_problem", "debug"].includes(intent.intent)) {
      return intent.complexity === "simple" ? "medium" : "high";
    }
  }

  // Intent-specific mapping
  switch (intent.intent) {
    case "document_qa":
    case "explain":
    case "summarize":
      return "low";
    case "compare":
    case "hint":
    case "quiz":
    case "socratic":
      return "medium";
    case "math_calculation":
    case "physics_problem":
    case "chemistry_problem":
    case "check_work":
    case "debug":
      return intent.complexity === "complex" ? "high" : "medium";
    default:
      return "medium";
  }
}
