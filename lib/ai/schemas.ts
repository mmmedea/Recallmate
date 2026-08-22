import { Type, Schema } from "@google/genai";
import { z } from "zod";

// --- Google GenAI Schemas ---
// Used to constrain the model's structural JSON output strictly at the API boundary

export const NotesGenAISchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                chunkIndex: { type: Type.INTEGER }
              },
              required: ["chunkIndex"]
            }
          }
        },
        required: ["title", "content", "sources"]
      }
    }
  },
  required: ["summary", "keyPoints", "topics"]
};

export const QuizGenAISchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correctAnswerIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                chunkIndex: { type: Type.INTEGER }
              },
              required: ["chunkIndex"]
            }
          }
        },
        required: ["question", "options", "correctAnswerIndex", "explanation", "sources"]
      }
    }
  },
  required: ["questions"]
};

export const ChatGenAISchema: Schema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chunkIndex: { type: Type.INTEGER }
        },
        required: ["chunkIndex"]
      }
    }
  },
  required: ["answer", "sources"]
};

// --- Zod Structural Schemas ---
// Used for runtime structural validation immediately after JSON parsing

export const SourceReferenceSchema = z.object({
  chunkIndex: z.number(),
  startOffset: z.number().optional(),
  endOffset: z.number().optional()
});

export const ZodChatSchema = z.object({
  answer: z.string(),
  sources: z.array(SourceReferenceSchema)
});

// --- Phase 6.8: Reviewer Maker Schemas ---

export const ReviewerGenAISchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subject: { type: Type.STRING },
    parts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["heading", "paragraph", "table", "note", "process"] },
          text: { type: Type.STRING },
          columns: { type: Type.ARRAY, items: { type: Type.STRING } },
          rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
          title: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          sourceChunkIds: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["type", "sourceChunkIds"]
      }
    }
  },
  required: ["title", "subject", "parts"]
};

export const ZodReviewerPartSchema = z.object({
  type: z.enum(["heading", "paragraph", "table", "note", "process"]),
  text: z.string().optional(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  sourceChunkIds: z.array(z.string())
});

export const ZodReviewerDocumentSchema = z.object({
  title: z.string(),
  subject: z.string(),
  parts: z.array(ZodReviewerPartSchema)
});

export const ZodNotesSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(SourceReferenceSchema)
  }))
});

export const ZodQuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctAnswerIndex: z.number(),
    explanation: z.string(),
    sources: z.array(SourceReferenceSchema)
  }))
});

export type GeneratedNotes = z.infer<typeof ZodNotesSchema>;
export type GeneratedQuiz = z.infer<typeof ZodQuizSchema>;
export type GeneratedChat = z.infer<typeof ZodChatSchema>;
export type GeneratedReviewerPart = z.infer<typeof ZodReviewerPartSchema>;
export type GeneratedReviewerDocument = z.infer<typeof ZodReviewerDocumentSchema>;

