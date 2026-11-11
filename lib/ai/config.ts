import { hasAnthropicCredentials } from "./anthropic-credentials";

export type AIOperation = 'extract_text' | 'generate_notes' | 'generate_quiz' | 'chat' | 'fast' | 'generate_reviewer';

export type AIProvider = 'google' | 'deepseek' | 'anthropic';

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

export class ReviewerAIConfigurationError extends Error {
  readonly status = 503;

  constructor(message = "Reviewer Maker is temporarily unavailable because Claude Reviewer is not configured.") {
    super(message);
    this.name = "ReviewerAIConfigurationError";
  }
}

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
  if (val === 'anthropic') return 'anthropic';
  if (val === 'deepseek') return 'deepseek';
  if (val === 'google') return 'google';
  return fallback;
};

const getReviewerProvider = (): AIProvider => {
  const configured = process.env.REVIEWER_AI_PROVIDER || process.env.AI_PROVIDER_REVIEWER;
  if (configured?.startsWith('sk-ant-')) {
    throw new ReviewerAIConfigurationError(
      'CRITICAL STARTUP ERROR: REVIEWER_AI_PROVIDER contains an Anthropic API key. Set REVIEWER_AI_PROVIDER=anthropic and put the secret in ANTHROPIC_API_KEY.'
    );
  }
  if (configured && configured !== 'anthropic') {
    throw new ReviewerAIConfigurationError(
      'Reviewer Maker is Claude-only for Reference Reviewer. Set REVIEWER_AI_PROVIDER=anthropic.'
    );
  }
  if (process.env.REVIEWER_AI_PROVIDER_2?.startsWith('sk-ant-')) {
    throw new ReviewerAIConfigurationError(
      'CRITICAL STARTUP ERROR: REVIEWER_AI_PROVIDER_2 contains an Anthropic API key. Use ANTHROPIC_API_KEY_2 or another ANTHROPIC_API_KEY_N slot instead.'
    );
  }
  return 'anthropic';
};

export const assertReviewerAIConfigured = () => {
  const config = ModelRegistry.generate_reviewer;
  if (config.provider !== 'anthropic') {
    throw new ReviewerAIConfigurationError('Reviewer Maker is temporarily unavailable. Claude Reviewer provider is not active.');
  }
  if (config.model !== 'claude-sonnet-5') {
    throw new ReviewerAIConfigurationError('Reviewer Maker is temporarily unavailable. REVIEWER_AI_MODEL must be claude-sonnet-5.');
  }
  if (!hasAnthropicCredentials()) {
    throw new ReviewerAIConfigurationError('Reviewer Maker is temporarily unavailable. No Anthropic API key is configured.');
  }
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
    // Keep provider configuration import-safe when a non-Google fallback is
    // active; this default is also the existing shared Gemini default.
    model: process.env.GEMINI_MODEL_QUIZ || process.env.GEMINI_MODEL_CHAT || 'gemini-3.7-flash',
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
    provider: getReviewerProvider(),
    model: process.env.REVIEWER_AI_MODEL || process.env.ANTHROPIC_MODEL_REVIEWER || 'claude-sonnet-5',
    operation: 'generate_reviewer',
    maxInputTokens: 1_048_576,
    maxOutputTokens: 8192, // High output for reviewer
    timeoutMs: 120000, // Double timeout for complex doc generation
    schemaVersion: 'reviewer_schema_v1',
    promptVersion: 'reviewer_prompt_v1.1'
  }
};
