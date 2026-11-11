import { expect, test, describe } from 'vitest'
import { GenerateContentSchema, EvaluateAnswerSchema, UploadDocumentSchema } from '../lib/validations'

describe('Zod Validation Boundary Tests', () => {
  test('GenerateContentSchema blocks prompts < 10 chars', () => {
    const result = GenerateContentSchema.safeParse({ text: 'short', fileName: 'test.pdf' })
    expect(result.success).toBe(false)
  })

  test('GenerateContentSchema blocks invalid difficulty', () => {
    const result = GenerateContentSchema.safeParse({ text: 'a very long valid text sample for parsing', difficulty: 'insane' })
    expect(result.success).toBe(false)
  })

  test('EvaluateAnswerSchema enforces UUIDs', () => {
    const result = EvaluateAnswerSchema.safeParse({ attemptId: 'not-a-uuid', questionId: 'not-a-uuid', selectedAnswer: 'A' })
    expect(result.success).toBe(false)
  })

  test('UploadDocumentSchema strictly enforces types', () => {
    const result = UploadDocumentSchema.safeParse({ fileName: 'file.pdf', fileSize: -100, contentType: 'application/pdf' })
    expect(result.success).toBe(false) // file size must be positive
  })
})
