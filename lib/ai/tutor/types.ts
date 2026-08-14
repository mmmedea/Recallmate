import { z } from "zod";

export const TutorDomainEnum = z.enum([
  "mathematics", "physics", "chemistry", "biology",
  "computer_science", "engineering", "statistics",
  "history", "literature", "language", "general_academic"
]);
export type TutorDomain = z.infer<typeof TutorDomainEnum>;

export const TutorIntentEnum = z.enum([
  "document_qa", "explain", "math_calculation", "physics_problem",
  "chemistry_problem", "hint", "socratic", "check_work",
  "summarize", "compare", "debug", "quiz"
]);
export type TutorIntentType = z.infer<typeof TutorIntentEnum>;

export const TutorComplexityEnum = z.enum(["simple", "moderate", "complex"]);
export type TutorComplexity = z.infer<typeof TutorComplexityEnum>;

export const TutorIntentSchema = z.object({
  intent: TutorIntentEnum,
  domain: TutorDomainEnum,
  complexity: TutorComplexityEnum,
  requiresTool: z.boolean(),
  requiresVerification: z.boolean(),
  confidence: z.number().min(0).max(1)
});

export type TutorIntent = z.infer<typeof TutorIntentSchema>;

export type TutorStrategyType = 
  | "direct_explanation" | "step_by_step" | "hint" | "socratic" 
  | "check_work" | "summarize" | "compare" | "debug";

export type ReasoningLevel = "low" | "medium" | "high";

export type TutorToolName = "code_execution" | "calculator" | "unit_check" | "symbolic_math";

export type ResponseFormat = "general" | "math" | "physics" | "chemistry" | "code";

export type ContextBudget = {
  maxHistoryTokens: number;
  maxEvidenceTokens: number;
  maxChunks: number;
  maxChunkTokens: number;
};

export type TutorPlan = {
  intent: TutorIntentType;
  domain: TutorDomain;
  complexity: TutorComplexity;
  strategy: TutorStrategyType;
  reasoningLevel: ReasoningLevel;
  tools: TutorToolName[];
  requiresVerification: boolean;
  responseFormat: ResponseFormat;
  contextBudget: ContextBudget;
  systemPrompt: string;
};

