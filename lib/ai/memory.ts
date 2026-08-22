import { RetrievedChunk } from "./retriever";

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

export type ConversationMemoryInput = {
  systemPrompt: string;
  question: string;
  retrievedContext: RetrievedChunk[];
  history: ChatMessage[];
  maxHistoryMessages?: number;
};

/**
 * Builds the prompt string combining system instruction, document context,
 * recent history, and the current question.
 */
export function buildBoundedMemoryPrompt(input: ConversationMemoryInput): string {
  const maxHistory = input.maxHistoryMessages || 10;
  
  let prompt = `${input.systemPrompt}\n\n`;

  // 1. Inject Retrieved Context
  if (input.retrievedContext.length > 0) {
    prompt += `--- RETRIEVED DOCUMENT CONTEXT ---\n`;
    for (const chunk of input.retrievedContext) {
      prompt += `[Source Chunk: ${chunk.chunk_index}] ${chunk.content}\n\n`;
    }
    prompt += `----------------------------------\n\n`;
  } else {
    prompt += `--- RETRIEVED DOCUMENT CONTEXT ---\n(No relevant document context found for this query)\n----------------------------------\n\n`;
  }

  // 2. Inject Conversation History (Truncated to maxHistory)
  if (input.history.length > 0) {
    const recentHistory = input.history.slice(-maxHistory);
    prompt += `--- CONVERSATION HISTORY ---\n`;
    for (const msg of recentHistory) {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
    prompt += `----------------------------\n\n`;
  }

  // 3. Inject Current Question
  prompt += `User: ${input.question}\n`;
  
  return prompt;
}
