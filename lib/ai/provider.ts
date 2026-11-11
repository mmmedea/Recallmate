import { GoogleGenAI } from "@google/genai";
import { ModelRegistry, AIOperation } from "./config";

// Singleton client instance
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
};

export type GenerateResponse = {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export class ProviderAdapter {
  static async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const config = ModelRegistry[request.operation];
    const client = getClient();

    const generationConfig: any = {
      max_output_tokens: config.maxOutputTokens,
    };

    if (request.responseSchema) {
      generationConfig.response_mime_type = "application/json";
      generationConfig.response_schema = request.responseSchema;
    }

    // Interactions API accepts previous conversation history
    // We append the prompt to the end as a new user message implicitly handled by the input
    const history = request.messages?.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    })) || undefined;

    try {
      const interaction = await client.interactions.create({
        model: config.model,
        input: request.prompt,
        system_instruction: request.systemInstruction,
        generation_config: generationConfig,
        store: false,
      });

      const usage = interaction.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

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
        stream: true,
        store: false,
     });
  }
}
