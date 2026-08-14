import { TutorIntent, ContextBudget } from "./types";

export function getContextBudget(intent: TutorIntent): ContextBudget {
  // Adaptive context sizing
  if (intent.complexity === "simple") {
    return { 
      maxHistoryTokens: 1000,
      maxEvidenceTokens: 2000,
      maxChunks: 3,
      maxChunkTokens: 500
    }; 
  } else if (intent.complexity === "moderate") {
    return { 
      maxHistoryTokens: 2500,
      maxEvidenceTokens: 4000,
      maxChunks: 6,
      maxChunkTokens: 500
    }; 
  } else {
    // complex (e.g., complex math/physics/chemistry) -> enough evidence to solve
    return { 
      maxHistoryTokens: 5000,
      maxEvidenceTokens: 8000,
      maxChunks: 10,
      maxChunkTokens: 800
    };
  }
}
