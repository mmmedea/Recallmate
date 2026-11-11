import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ModelRegistry, AIOperation, type AIProvider } from "./config";
import { AnthropicCredential, getAnthropicCredentials } from "./anthropic-credentials";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

// Singleton client instances
let _client: GoogleGenAI | null = null;
let _clientApiKey: string | null = null;
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY;
  if (!apiKey) {
      throw new Error("CRITICAL ERROR: GEMINI_API_KEY is not set.");
  }
  if (!_client || _clientApiKey !== apiKey) {
    _client = new GoogleGenAI({ apiKey });
    _clientApiKey = apiKey;
  }
  return _client;
};

let _deepSeekClient: OpenAI | null = null;
const getDeepSeekClient = () => {
  if (!_deepSeekClient) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("CRITICAL ERROR: DEEPSEEK_API_KEY is not set.");
    }
    _deepSeekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return _deepSeekClient;
};

const _anthropicClients = new Map<string, Anthropic>();
const getAnthropicClient = (credential: AnthropicCredential) => {
  const cacheKey = `${credential.slot}:${credential.envName}`;
  const cached = _anthropicClients.get(cacheKey);
  if (cached) return cached;

  const client = new Anthropic({ apiKey: credential.apiKey });
  _anthropicClients.set(cacheKey, client);
  return client;
};

export type Message = {
  role: 'user' | 'assistant' | 'model';
  content: string;
};

export type GenerateRequest = {
  operation: Exclude<AIOperation, 'extract_text'>;
  systemInstruction?: string;
  prompt: string;
  messages?: Message[]; // Optional chat history
  responseSchema?: any; // JSON Schema for structured output
  tools?: any[]; // Array of Gemini Tool declarations
};

export type GenerateResponse = {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export type GeminiUsageMetadata = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  thoughtsTokens: number;
};

export type AIProviderResult<T> = {
  data: T;
  usage: GeminiUsageMetadata;
  metadata?: {
    provider: string;
    model: string;
    durationMs: number;
    structuredOutputMode?: "strict_tool";
    repairCalls?: number;
    credentialSlot?: number;
    credentialGroup?: string;
    credentialAttempts?: AnthropicAttemptDiagnostic[];
  };
};

type AnthropicAttemptDiagnostic = {
  slot: number;
  group: string;
  status?: number;
  errorType?: string;
  healthState?: "healthy" | "cooldown" | "disabled";
  retryAfterSeconds?: number;
  category: "key" | "group" | "provider" | "policy" | "unknown";
};

class AnthropicCredentialPoolError extends Error {
  constructor(message: string, readonly attempts: AnthropicAttemptDiagnostic[]) {
    super(message);
    this.name = "AnthropicCredentialPoolError";
  }
}

type AnthropicCredentialHealth = {
  state: "healthy" | "cooldown" | "disabled";
  lastFailureAt?: number;
  cooldownUntil?: number;
  disabledReason?: string;
};

const anthropicCredentialHealth = new Map<string, AnthropicCredentialHealth>();

function getCredentialCacheKey(credential: AnthropicCredential) {
  return `${credential.slot}:${credential.envName}`;
}

async function readCredentialHealth(credential: AnthropicCredential): Promise<AnthropicCredentialHealth> {
  const persistent = await readPersistentCredentialHealth(credential);
  if (persistent) return persistent;

  const key = getCredentialCacheKey(credential);
  const health = anthropicCredentialHealth.get(key);
  if (!health) return { state: "healthy" };

  if (health.state === "cooldown" && health.cooldownUntil && Date.now() >= health.cooldownUntil) {
    anthropicCredentialHealth.set(key, { state: "healthy" });
    return { state: "healthy" };
  }

  return health;
}

async function setCredentialHealth(credential: AnthropicCredential, health: AnthropicCredentialHealth) {
  anthropicCredentialHealth.set(getCredentialCacheKey(credential), health);
  await writePersistentCredentialHealth(credential, health);
}

async function setGroupCooldown(credentials: AnthropicCredential[], group: string, retryAfterSeconds: number, reason: string) {
  const now = Date.now();
  for (const credential of credentials) {
    if (credential.group !== group) continue;
    await setCredentialHealth(credential, {
      state: "cooldown",
      lastFailureAt: now,
      cooldownUntil: now + retryAfterSeconds * 1000,
      disabledReason: reason,
    });
  }
}

export class ProviderAdapter {
  
  static async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const config = ModelRegistry[request.operation];

    const generationConfig: any = {
      max_output_tokens: config.maxOutputTokens,
    };

    if (request.responseSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = request.responseSchema;
    }

    const openAiHistory = request.messages?.map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content
    })) || [];

    try {
      if (config.provider === 'deepseek') {
         if (request.responseSchema) {
             const res = await ProviderAdapter.executeDeepSeek<any>(config, request.systemInstruction || '', request.prompt, request.responseSchema);
             return {
                 text: JSON.stringify(res.data),
                 usage: {
                     inputTokens: res.usage.inputTokens,
                     outputTokens: res.usage.outputTokens,
                     totalTokens: res.usage.inputTokens + res.usage.outputTokens
                 }
             }
         } else {
             // Basic deepseek completion (not needed right now but adding for safety)
             const client = getDeepSeekClient();
             const response = await client.chat.completions.create({
                model: config.model === 'gemini-1.5-flash' ? 'deepseek-chat' : config.model,
                messages: [
                    { role: 'system', content: request.systemInstruction || '' },
                    ...openAiHistory,
                    { role: 'user', content: request.prompt }
                ]
             });
             return {
                 text: response.choices[0].message.content || "",
                 usage: {
                     inputTokens: response.usage?.prompt_tokens || 0,
                     outputTokens: response.usage?.completion_tokens || 0,
                     totalTokens: response.usage?.total_tokens || 0
                 }
             }
         }
      }

      if (config.provider === 'anthropic') {
        if (!request.responseSchema) {
          const { response } = await ProviderAdapter.executeWithAnthropicCredential((client) => client.messages.create({
            model: config.model,
            max_tokens: config.maxOutputTokens,
            system: request.systemInstruction,
            messages: [
              ...openAiHistory.map((message) => ({
                role: message.role,
                content: message.content,
              })),
              { role: 'user', content: request.prompt },
            ],
          } as any));
          const text = extractAnthropicText(response);
          return {
            text,
            usage: {
              inputTokens: response.usage?.input_tokens || 0,
              outputTokens: response.usage?.output_tokens || 0,
              totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            },
          };
        }

        const res = await ProviderAdapter.executeAnthropic<any>(config, request.systemInstruction || '', request.prompt, request.responseSchema);
        return {
          text: JSON.stringify(res.data),
          usage: {
            inputTokens: res.usage.inputTokens,
            outputTokens: res.usage.outputTokens,
            totalTokens: res.usage.inputTokens + res.usage.outputTokens,
          },
        };
      }

      const client = getClient();

      if (request.responseSchema) {
        const response = await client.models.generateContent({
          model: config.model,
          contents: request.prompt,
          config: {
            systemInstruction: request.systemInstruction,
            responseMimeType: "application/json",
            responseSchema: request.responseSchema,
            maxOutputTokens: generationConfig.max_output_tokens
          }
        });
        return {
          text: response.text || "",
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
          }
        };
      }

      const interaction = await client.interactions.create({
        model: config.model,
        input: request.prompt,
        system_instruction: request.systemInstruction,
        generation_config: generationConfig,
        tools: request.tools,
        store: false,
      });

      const usage: any = interaction.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

      return {
        text: interaction.output_text || "",
        usage: {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        }
      };
    } catch (error) {
      console.error(`ProviderAdapter Error [${request.operation}]:`, error);
      throw new Error(`Failed to execute AI operation: ${request.operation}`);
    }
  }

  static async stream(request: GenerateRequest): Promise<AsyncIterable<any>> {
     const config = ModelRegistry[request.operation];
     const client = getClient();
     
     const generationConfig: any = {
        max_output_tokens: config.maxOutputTokens,
     };

     return await client.interactions.create({
        model: config.model,
        input: request.prompt,
        system_instruction: request.systemInstruction,
        generation_config: generationConfig,
        tools: request.tools,
        stream: true,
        store: false,
     });
  }

  static async executeStructuredGeneration<T>(
    operation: Exclude<AIOperation, 'extract_text'>,
    systemInstruction: string,
    prompt: string,
    schema: any
  ): Promise<AIProviderResult<T>> {
    const config = ModelRegistry[operation];

    try {
      if (config.provider === 'anthropic') {
        return await this.executeAnthropic<T>(config, systemInstruction, prompt, schema);
      } else if (config.provider === 'deepseek') {
        return await this.executeDeepSeek<T>(config, systemInstruction, prompt, schema);
      } else {
        return await this.executeGemini<T>(config, systemInstruction, prompt, schema);
      }
    } catch (error) {
      console.error(`ProviderAdapter Error [${operation} using ${config.provider}]:`, error);
      throw error;
    }
  }

  static async generateStructuredForProvider<T>(
    operation: Exclude<AIOperation, 'extract_text'>,
    provider: AIProvider,
    model: string,
    systemInstruction: string,
    prompt: string,
    schema: any,
  ): Promise<AIProviderResult<T>> {
    const config = { ...ModelRegistry[operation], provider, model };
    if (provider === 'anthropic') {
      return this.executeAnthropicJson<T>(config, systemInstruction, prompt, schema);
    }
    if (provider === 'deepseek') {
      return this.executeDeepSeek<T>(config, systemInstruction, prompt, schema);
    }
    return this.executeGemini<T>(config, systemInstruction, prompt, schema);
  }

  private static async executeGemini<T>(
    config: any,
    systemInstruction: string,
    prompt: string,
    schema: any
  ): Promise<AIProviderResult<T>> {
    const client = getClient();
    const response = await client.models.generateContent({
      model: config.model,
      contents: prompt,
      config: {
        systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: config.maxOutputTokens,
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error('No text returned from Gemini provider');

    let data: T;
    try {
      data = JSON.parse(responseText) as T;
    } catch (e) {
      throw new Error('Failed to parse Gemini structured JSON output');
    }

    const usageMetadata = response.usageMetadata;
    const usage: GeminiUsageMetadata = {
      inputTokens: usageMetadata?.promptTokenCount || 0,
      outputTokens: usageMetadata?.candidatesTokenCount || 0,
      cachedTokens: usageMetadata?.cachedContentTokenCount || 0,
      thoughtsTokens: (usageMetadata as any)?.candidatesTokenDetails?.[0]?.tokenCount || 0
    };

    return { data, usage };
  }

  private static async executeDeepSeek<T>(
    config: any,
    systemInstruction: string,
    prompt: string,
    schema: any
  ): Promise<AIProviderResult<T>> {
    const client = getDeepSeekClient();
    
    // Convert JSON schema to string to guide DeepSeek
    const schemaString = JSON.stringify(schema, null, 2);
    const fullSystemInstruction = `${systemInstruction}\n\nYou must respond with JSON strictly adhering to the following JSON schema. Do not wrap it in markdown block quotes, output ONLY valid JSON.\n\nSchema:\n${schemaString}`;

    // Map internal default model names if necessary
    const targetModel = config.model === 'gemini-1.5-flash' ? 'deepseek-chat' : config.model;

    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: fullSystemInstruction },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No text returned from DeepSeek provider');

    // Remove any accidental markdown wrapping just in case
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.replace(/^```json\n?/, '');
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.replace(/^```\n?/, '');
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.replace(/\n?```$/, '');

    let data: T;
    try {
      data = JSON.parse(cleanContent) as T;
    } catch (e) {
      console.error("DeepSeek raw output:", cleanContent);
      throw new Error('Failed to parse DeepSeek structured JSON output');
    }

    const rawUsage = response.usage;
    
    // Sometimes DeepSeek provides reasoning tokens in completion_tokens_details
    const reasoningTokens = (rawUsage as any)?.completion_tokens_details?.reasoning_tokens || 0;
    
    const usage: GeminiUsageMetadata = {
      inputTokens: rawUsage?.prompt_tokens || 0,
      outputTokens: rawUsage?.completion_tokens || 0,
      cachedTokens: (rawUsage as any)?.prompt_tokens_details?.cached_tokens || 0,
      thoughtsTokens: reasoningTokens
    };

    return { data, usage };
  }

  private static async executeAnthropic<T>(
    config: any,
    systemInstruction: string,
    prompt: string,
    schema: any
  ): Promise<AIProviderResult<T>> {
    const normalizedSchema = normalizeJsonSchema(schema);
    const toolName = "return_structured_reviewer";
    const startedAt = Date.now();

    const { response, credential, attempts } = await this.executeWithAnthropicCredential((client) => client.messages.create({
      model: config.model,
      max_tokens: config.maxOutputTokens,
      system: `${systemInstruction}

Return only through the required structured output tool. Do not place the final JSON in normal text.
The tool input is the canonical ReviewerDocument object. Every factual part must retain valid sourceChunkIds.`,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: toolName,
          description: "Return the validated structured reviewer document.",
          input_schema: normalizedSchema,
          strict: true,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    } as any));

    const toolUse = (response.content as any[])?.find((block) => block?.type === "tool_use" && block?.name === toolName);
    if (!toolUse?.input) {
      throw new Error("No strict structured output tool payload returned from Anthropic provider");
    }

    return {
      data: toolUse.input as T,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cachedTokens: 0,
        thoughtsTokens: 0,
      },
      metadata: {
        provider: "anthropic",
        model: config.model,
        durationMs: Date.now() - startedAt,
        structuredOutputMode: "strict_tool",
        repairCalls: 0,
        credentialSlot: credential.slot,
        credentialGroup: credential.group,
        credentialAttempts: attempts,
      },
    };
  }

  private static async executeAnthropicJson<T>(
    config: any,
    systemInstruction: string,
    prompt: string,
    schema: any,
  ): Promise<AIProviderResult<T>> {
    const normalizedSchema = normalizeJsonSchema(schema);
    const toolName = "return_structured_json";
    const startedAt = Date.now();
    const { response, credential, attempts } = await this.executeWithAnthropicCredential((client) => client.messages.create({
      model: config.model,
      max_tokens: config.maxOutputTokens,
      system: `${systemInstruction}\n\nReturn only through the required structured output tool. Its input must match the supplied JSON schema exactly.`,
      messages: [{ role: "user", content: prompt }],
      tools: [{
        name: toolName,
        description: "Return the requested structured JSON object matching the supplied schema.",
        input_schema: normalizedSchema,
        strict: true,
      }],
      tool_choice: { type: "tool", name: toolName },
    } as any));

    const toolUse = (response.content as any[])?.find((block) => block?.type === "tool_use" && block?.name === toolName);
    if (!toolUse?.input) throw new Error("No structured JSON payload returned from Anthropic provider");

    return {
      data: toolUse.input as T,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cachedTokens: 0,
        thoughtsTokens: 0,
      },
      metadata: {
        provider: "anthropic",
        model: config.model,
        durationMs: Date.now() - startedAt,
        structuredOutputMode: "strict_tool",
        repairCalls: 0,
        credentialSlot: credential.slot,
        credentialGroup: credential.group,
        credentialAttempts: attempts,
      },
    };
  }

  private static async executeWithAnthropicCredential<T>(
    call: (client: Anthropic, credential: AnthropicCredential) => Promise<T>
  ): Promise<{ response: T; credential: AnthropicCredential; attempts: AnthropicAttemptDiagnostic[] }> {
    const credentials = getAnthropicCredentials();
    if (credentials.length === 0) {
      throw new AnthropicCredentialPoolError("No Anthropic credentials are configured.", []);
    }

    const attempts: AnthropicAttemptDiagnostic[] = [];
    const skippedGroups = new Set<string>();

    for (const credential of credentials) {
      if (skippedGroups.has(credential.group)) continue;
      const health = await readCredentialHealth(credential);
      if (health.state !== "healthy") {
        attempts.push({
          slot: credential.slot,
          group: credential.group,
          healthState: health.state,
          category: health.state === "disabled" ? "key" : "provider",
        });
        continue;
      }

      try {
        const response = await call(getAnthropicClient(credential), credential);
        await setCredentialHealth(credential, { state: "healthy" });
        return { response, credential, attempts };
      } catch (error) {
        const classification = classifyAnthropicError(error);
        const retryAfterSeconds = getRetryAfterSeconds(error) ?? classification.retryAfterSeconds;

        if (classification.healthState === "disabled") {
          await setCredentialHealth(credential, {
            state: "disabled",
            lastFailureAt: Date.now(),
            disabledReason: classification.message,
          });
        } else if (classification.healthState === "cooldown") {
          await setCredentialHealth(credential, {
            state: "cooldown",
            lastFailureAt: Date.now(),
            cooldownUntil: Date.now() + retryAfterSeconds * 1000,
            disabledReason: classification.message,
          });
        }

        if (classification.action === "cooldown_group_fail_closed") {
          await setGroupCooldown(credentials, credential.group, retryAfterSeconds, classification.message);
        }

        attempts.push({
          slot: credential.slot,
          group: credential.group,
          status: getErrorStatus(error),
          errorType: getErrorType(error),
          healthState: classification.healthState,
          retryAfterSeconds,
          category: classification.category,
        });

        if (classification.action === "fail_closed" || classification.action === "cooldown_group_fail_closed") {
          throw new AnthropicCredentialPoolError(classification.message, attempts);
        }

        if (classification.action === "skip_group") {
          skippedGroups.add(credential.group);
        }
      }
    }

    throw new AnthropicCredentialPoolError(
      "All configured Anthropic credentials are currently unavailable.",
      attempts
    );
  }
}

type QuizProviderCandidate = { provider: AIProvider; model: string };
const QUIZ_PROVIDER_ATTEMPTS = 3;
const QUIZ_RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

function isTransientQuizProviderError(error: unknown): boolean {
  const status = getErrorStatus(error) ?? Number((error as any)?.code);
  return (
    QUIZ_RETRYABLE_HTTP_STATUSES.has(status) ||
    /high demand|overloaded|temporarily unavailable/i.test(getErrorMessage(error))
  );
}

async function withQuizProviderRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < QUIZ_PROVIDER_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === QUIZ_PROVIDER_ATTEMPTS - 1 || !isTransientQuizProviderError(error)) {
        throw error;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
    }
  }

  throw new Error("Quiz provider retry loop exited unexpectedly.");
}

export function getQuizProviderCandidates(
  primaryProvider: AIProvider = ModelRegistry.generate_quiz.provider,
): QuizProviderCandidate[] {
  const configured: Record<AIProvider, { available: boolean; model: string }> = {
    google: {
      available: Boolean(process.env.GEMINI_API_KEY_02 || process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL_QUIZ || process.env.GEMINI_MODEL_CHAT || ModelRegistry.generate_quiz.model || "gemini-3.7-flash",
    },
    deepseek: {
      available: Boolean(process.env.DEEPSEEK_API_KEY),
      model: process.env.DEEPSEEK_MODEL_QUIZ || "deepseek-chat",
    },
    anthropic: {
      available: getAnthropicCredentials().length > 0,
      model: process.env.ANTHROPIC_MODEL_QUIZ || process.env.ANTHROPIC_MODEL_REVIEWER || "claude-sonnet-5",
    },
  };
  const order: AIProvider[] = [primaryProvider, "google", "deepseek", "anthropic"];
  const seen = new Set<AIProvider>();
  return order.flatMap((provider) => {
    if (seen.has(provider) || !configured[provider].available) return [];
    seen.add(provider);
    return [{ provider, model: configured[provider].model }];
  });
}

export async function generateJson<T>({
  system,
  user,
  schema,
  operation = "generate_quiz",
}: {
  system: string;
  user: string;
  schema: unknown;
  operation?: Exclude<AIOperation, "extract_text">;
}): Promise<T> {
  const candidates = getQuizProviderCandidates();
  if (candidates.length === 0) throw new Error("No structured quiz provider is configured.");

  for (const candidate of candidates) {
    try {
      const result = await withQuizProviderRetry(async () => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        return Promise.race([
          ProviderAdapter.generateStructuredForProvider<T>(
            operation,
            candidate.provider,
            candidate.model,
            system,
            user,
            schema,
          ),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Provider request timed out.")), 17_000);
          }),
        ]).finally(() => {
          if (timeout) clearTimeout(timeout);
        });
      });
      return result.data;
    } catch {
      // Provider error details may contain request metadata; log only the provider.
      console.warn(`[Quiz generation] ${candidate.provider} structured request failed; trying the next configured provider.`);
    }
  }

  throw new Error("All configured structured quiz providers failed.");
}

async function readPersistentCredentialHealth(credential: AnthropicCredential): Promise<AnthropicCredentialHealth | null> {
  if (!isSupabaseAdminConfigured()) return null;

  try {
    const supabase = createSupabaseAdminClient<any>();
    const { data, error } = await supabase
      .from("anthropic_credential_health")
      .select("status, cooldown_until, disabled_reason, last_failure_at")
      .eq("slot", credential.slot)
      .maybeSingle();

    if (error || !data) return null;

    if (data.status === "cooldown") {
      const cooldownUntil = data.cooldown_until ? Date.parse(data.cooldown_until) : undefined;
      if (cooldownUntil && Date.now() >= cooldownUntil) {
        return { state: "healthy" };
      }
      return {
        state: "cooldown",
        cooldownUntil,
        disabledReason: data.disabled_reason || undefined,
        lastFailureAt: data.last_failure_at ? Date.parse(data.last_failure_at) : undefined,
      };
    }

    if (data.status === "disabled") {
      return {
        state: "disabled",
        disabledReason: data.disabled_reason || undefined,
        lastFailureAt: data.last_failure_at ? Date.parse(data.last_failure_at) : undefined,
      };
    }

    return { state: "healthy" };
  } catch {
    return null;
  }
}

async function writePersistentCredentialHealth(credential: AnthropicCredential, health: AnthropicCredentialHealth) {
  if (!isSupabaseAdminConfigured()) return;

  try {
    const supabase = createSupabaseAdminClient<any>();
    await supabase.from("anthropic_credential_health").upsert(
      {
        slot: credential.slot,
        credential_group: credential.group,
        priority: credential.priority,
        status: health.state,
        disabled_reason: health.disabledReason ?? null,
        cooldown_until: health.cooldownUntil ? new Date(health.cooldownUntil).toISOString() : null,
        last_failure_at: health.lastFailureAt ? new Date(health.lastFailureAt).toISOString() : null,
        last_success_at: health.state === "healthy" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slot" }
    );
  } catch {
    // Best-effort observability only. The in-process circuit breaker still applies.
  }
}

function classifyAnthropicError(error: unknown): {
  action: "try_next_key" | "skip_group" | "fail_closed" | "cooldown_group_fail_closed";
  category: AnthropicAttemptDiagnostic["category"];
  healthState: AnthropicCredentialHealth["state"];
  retryAfterSeconds: number;
  message: string;
} {
  const status = getErrorStatus(error);
  const type = getErrorType(error);
  const message = getErrorMessage(error).toLowerCase();

  if (/(suspend|suspended|restriction|restricted|abuse|policy|violation)/i.test(message)) {
    return {
      action: "fail_closed",
      category: "policy",
      healthState: "disabled",
      retryAfterSeconds: 3600,
      message: "Anthropic access is restricted by provider policy. Reviewer Maker failed safely.",
    };
  }

  if (status === 401 || type === "authentication_error") {
    return {
      action: "try_next_key",
      category: "key",
      healthState: "disabled",
      retryAfterSeconds: 0,
      message: "Anthropic credential failed authentication.",
    };
  }

  if (status === 429 || type === "rate_limit_error") {
    return {
      action: "cooldown_group_fail_closed",
      category: "group",
      healthState: "cooldown",
      retryAfterSeconds: getRetryAfterSeconds(error) ?? 60,
      message: "Anthropic rate limit reached. Reviewer Maker is backing off instead of rotating keys.",
    };
  }

  if (
    status === 403 ||
    status === 402 ||
    type === "permission_error" ||
    type === "billing_error" ||
    (status === 400 && /(billing|credit|spend|quota|organization|workspace|usage limit|rate limit)/i.test(message))
  ) {
    return {
      action: "skip_group",
      category: "group",
      healthState: "cooldown",
      retryAfterSeconds: 3600,
      message: "Anthropic credential group is unavailable.",
    };
  }

  if (status === 500 || status === 504 || status === 529 || type === "api_error" || type === "overloaded_error" || type === "timeout_error") {
    return {
      action: "try_next_key",
      category: "provider",
      healthState: "cooldown",
      retryAfterSeconds: getRetryAfterSeconds(error) ?? 30,
      message: "Anthropic provider is temporarily unavailable.",
    };
  }

  return {
    action: "try_next_key",
    category: "unknown",
    healthState: "cooldown",
    retryAfterSeconds: 30,
    message: "Anthropic request failed for this credential.",
  };
}

function getErrorStatus(error: unknown): number | undefined {
  const value = (error as any)?.status ?? (error as any)?.response?.status;
  return typeof value === "number" ? value : undefined;
}

function getErrorType(error: unknown): string | undefined {
  const value = (error as any)?.error?.type ?? (error as any)?.type;
  return typeof value === "string" ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  return String((error as any)?.error?.message ?? (error as any)?.message ?? "");
}

function getRetryAfterSeconds(error: unknown): number | undefined {
  const headers = (error as any)?.headers ?? (error as any)?.response?.headers;
  const raw =
    typeof headers?.get === "function"
      ? headers.get("retry-after")
      : headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) return undefined;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;

  const dateMs = Date.parse(String(raw));
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  }

  return undefined;
}

export async function estimateTokens(content: string, operation: Exclude<AIOperation, 'extract_text'> = 'chat'): Promise<number> {
    const config = ModelRegistry[operation];
    if (config.provider === 'deepseek' || config.provider === 'anthropic') {
      return Math.ceil(content.length / 4);
    }
    const client = getClient();
    try {
      const response = await client.models.countTokens({
        model: config.model,
        contents: content
      });
      return response.totalTokens || 0;
    } catch (e) {
      return Math.ceil(content.length / 4);
    }
}

function extractAnthropicText(response: any): string {
  return (response.content || [])
    .filter((block: any) => block?.type === "text" && typeof block.text === "string")
    .map((block: any) => block.text)
    .join("\n")
    .trim();
}

function stripMarkdownJson(content: string): string {
  let cleanContent = content.trim();
  if (cleanContent.startsWith("```json")) cleanContent = cleanContent.replace(/^```json\n?/, "");
  if (cleanContent.startsWith("```")) cleanContent = cleanContent.replace(/^```\n?/, "");
  if (cleanContent.endsWith("```")) cleanContent = cleanContent.replace(/\n?```$/, "");
  return cleanContent.trim();
}

function normalizeJsonSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(normalizeJsonSchema);
  if (!schema || typeof schema !== "object") return schema;

  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      normalized[key] = value.toLowerCase();
    } else {
      normalized[key] = normalizeJsonSchema(value);
    }
  }

  return normalized;
}
