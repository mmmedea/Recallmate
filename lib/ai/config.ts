export type AIOperation = 'extract_text' | 'generate_notes' | 'generate_quiz' | 'chat' | 'fast' | 'generate_reviewer';

export type AIProvider = 'google' | 'deepseek';

export type AIModelConfig = {
  provider: AIProvider;
  model: string;
  operation: AIOperation;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  schemaVersion: string;
  promptVersion: string;
};

// Validates that required environment variables for models are set.
const requireEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`CRITICAL STARTUP ERROR: Missing required environment variable ${name}`);
  }
  return value;
};

const getProvider = (envVar: string, fallback: AIProvider = 'google'): AIProvider => {
  const val = process.env[envVar];
  if (val === 'deepseek') return 'deepseek';
  if (val === 'google') return 'google';
  return fallback;
};

// Model Registry: Defines the configuration for each AI operation.
export const ModelRegistry: Record<Exclude<AIOperation, 'extract_text'>, AIModelConfig> = {
  fast: {
    provider: getProvider('AI_PROVIDER_FAST', 'google'),
    model: process.env.GEMINI_MODEL_FAST || process.env.GEMINI_MODEL_CHAT || requireEnvVar('GEMINI_MODEL_CHAT'),
    operation: 'fast',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 2048,
    timeoutMs: 15000,
    schemaVersion: 'fast_schema_v1',
    promptVersion: 'fast_prompt_v1'
  },
  generate_notes: {
    provider: getProvider('AI_PROVIDER_NOTES', 'google'),
    model: process.env.GEMINI_MODEL_NOTES || requireEnvVar('GEMINI_MODEL_NOTES'), // Will throw if undefined
    operation: 'generate_notes',
    maxInputTokens: 1_048_576, // Gemini Flash 1M context
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    schemaVersion: 'notes_schema_v1',
    promptVersion: 'notes_prompt_v1'
  },
  generate_quiz: {
    provider: getProvider('AI_PROVIDER_QUIZ', 'google'),
    model: process.env.GEMINI_MODEL_QUIZ || requireEnvVar('GEMINI_MODEL_QUIZ'),
    operation: 'generate_quiz',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    schemaVersion: 'quiz_schema_v1',
    promptVersion: 'quiz_prompt_v1'
  },
  chat: {
    provider: getProvider('AI_PROVIDER_CHAT', 'google'),
    model: process.env.GEMINI_MODEL_CHAT || requireEnvVar('GEMINI_MODEL_CHAT'),
    operation: 'chat',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192,
    timeoutMs: 30000,
    schemaVersion: 'chat_schema_v1',
    promptVersion: 'medea-chat-v1'
  },
  generate_reviewer: {
    provider: getProvider('AI_PROVIDER_REVIEWER', 'google'),
    model: process.env.GEMINI_MODEL_NOTES || requireEnvVar('GEMINI_MODEL_NOTES'), // Reuse notes model explicitly
    operation: 'generate_reviewer',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192, // High output for reviewer
    timeoutMs: 120000, // Double timeout for complex doc generation
    schemaVersion: 'reviewer_schema_v1',
    promptVersion: 'reviewer_prompt_v1.0'
  }
};
