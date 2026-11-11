import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { ModelRegistry, AIOperation } from "./config";

// Singleton client instances
let _client: GoogleGenAI | null = null;
const getClient = () => {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("CRITICAL ERROR: GEMINI_API_KEY is not set.");
    }
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
};

export class ProviderAdapter {
  
  static async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const config = ModelRegistry[request.operation];
    const client = getClient();

    const generationConfig: any = {
      max_output_tokens: config.maxOutputTokens,
    };

    if (request.responseSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = request.responseSchema;
    }

    const history = request.messages?.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    })) || undefined;

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
                    ...history || [],
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
      if (config.provider === 'deepseek') {
        return await this.executeDeepSeek<T>(config, systemInstruction, prompt, schema);
      } else {
        return await this.executeGemini<T>(config, systemInstruction, prompt, schema);
      }
    } catch (error) {
      console.error(`ProviderAdapter Error [${operation} using ${config.provider}]:`, error);
      throw error;
    }
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
}

export async function estimateTokens(content: string, operation: Exclude<AIOperation, 'extract_text'> = 'chat'): Promise<number> {
    const config = ModelRegistry[operation];
    if (config.provider === 'deepseek') {
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
