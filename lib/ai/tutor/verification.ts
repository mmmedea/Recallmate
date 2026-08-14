import { TutorIntent } from "./types";

export function getVerificationPolicy(intent: TutorIntent): boolean {
  // Simple explanation -> no verification pass
  if (intent.complexity === "simple" && ["explain", "summarize"].includes(intent.intent)) {
    return false;
  }
  
  // Document factual answer -> citation validation
  // Math calculation -> calculation verification
  // Physics/Chemistry calculation -> calculation + unit/dimensional verification
  // Complex derivation -> consistency verification
  // Check-my-work -> recompute independently
  
  if (intent.requiresVerification) {
    return true;
  }

  // By default, moderate/complex problems or calculations get verification
  if (["math_calculation", "physics_problem", "chemistry_problem", "check_work", "document_qa"].includes(intent.intent)) {
    return true;
  }
  
  if (intent.complexity === "complex") {
    return true;
  }
  
  return false;
}
