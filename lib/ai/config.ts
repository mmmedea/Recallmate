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

// Model identifiers are configuration, not credentials. Keep them available at
// build time with safe defaults; provider API keys are validated only when a
// request actually invokes the selected provider.
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

const getModel = (
  provider: AIProvider,
  envVar: string,
  fallback = DEFAULT_GEMINI_MODEL
): string => {
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  }
  return process.env[envVar] || fallback;
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
    model: getModel(
      getProvider('AI_PROVIDER_FAST', 'google'),
      'GEMINI_MODEL_FAST',
      process.env.GEMINI_MODEL_CHAT || DEFAULT_GEMINI_MODEL
    ),
    operation: 'fast',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 2048,
    timeoutMs: 15000,
    schemaVersion: 'fast_schema_v1',
    promptVersion: 'fast_prompt_v1'
  },
  generate_notes: {
    provider: getProvider('AI_PROVIDER_NOTES', 'google'),
    model: getModel(getProvider('AI_PROVIDER_NOTES', 'google'), 'GEMINI_MODEL_NOTES'),
    operation: 'generate_notes',
    maxInputTokens: 1_048_576, // Gemini Flash 1M context
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    schemaVersion: 'notes_schema_v1',
    promptVersion: 'notes_prompt_v1'
  },
  generate_quiz: {
    provider: getProvider('AI_PROVIDER_QUIZ', 'google'),
    model: getModel(getProvider('AI_PROVIDER_QUIZ', 'google'), 'GEMINI_MODEL_QUIZ'),
    operation: 'generate_quiz',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    schemaVersion: 'quiz_schema_v1',
    promptVersion: 'quiz_prompt_v1'
  },
  chat: {
    provider: getProvider('AI_PROVIDER_CHAT', 'google'),
    model: getModel(getProvider('AI_PROVIDER_CHAT', 'google'), 'GEMINI_MODEL_CHAT'),
    operation: 'chat',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192,
    timeoutMs: 30000,
    schemaVersion: 'chat_schema_v1',
    promptVersion: 'medea-chat-v1'
  },
  generate_reviewer: {
    provider: getProvider('AI_PROVIDER_REVIEWER', 'google'),
    model: getModel(getProvider('AI_PROVIDER_REVIEWER', 'google'), 'GEMINI_MODEL_NOTES'),
    operation: 'generate_reviewer',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192, // High output for reviewer
    timeoutMs: 120000, // Double timeout for complex doc generation
    schemaVersion: 'reviewer_schema_v1',
    promptVersion: 'reviewer_prompt_v1.0'
  }
};
