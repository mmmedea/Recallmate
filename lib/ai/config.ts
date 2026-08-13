export type AIOperation = 'extract_text' | 'generate_notes' | 'generate_quiz' | 'chat';

export type AIModelConfig = {
  provider: 'google'; // Currently only google is supported, but architecture allows others
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

// Model Registry: Defines the configuration for each AI operation.
export const ModelRegistry: Record<Exclude<AIOperation, 'extract_text'>, AIModelConfig> = {
  generate_notes: {
    provider: 'google',
    model: process.env.GEMINI_MODEL_NOTES || requireEnvVar('GEMINI_MODEL_NOTES'), // Will throw if undefined
    operation: 'generate_notes',
    maxInputTokens: 1_048_576, // Gemini Flash 1M context
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    schemaVersion: 'notes_schema_v1',
    promptVersion: 'notes_prompt_v1'
  },
  generate_quiz: {
    provider: 'google',
    model: process.env.GEMINI_MODEL_QUIZ || requireEnvVar('GEMINI_MODEL_QUIZ'),
    operation: 'generate_quiz',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    schemaVersion: 'quiz_schema_v1',
    promptVersion: 'quiz_prompt_v1'
  },
  chat: {
    provider: 'google',
    model: process.env.GEMINI_MODEL_CHAT || requireEnvVar('GEMINI_MODEL_CHAT'),
    operation: 'chat',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192,
    timeoutMs: 30000,
    schemaVersion: 'chat_schema_v1',
    promptVersion: 'chat_prompt_v1'
  }
};
