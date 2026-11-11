import { z } from 'zod'

export const GenerateContentSchema = z.object({
  text: z.string().min(10).max(12000),
  fileName: z.string().optional(),
  count: z.number().min(5).max(50).optional().default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('easy'),
  documentId: z.string().uuid().optional(), // If generated from an existing document
})

export const EvaluateAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedAnswer: z.string().min(1)
})

export const UploadDocumentSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  contentType: z.string().min(1),
})
