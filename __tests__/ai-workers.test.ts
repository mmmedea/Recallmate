import { describe, it, expect } from 'vitest';
import { validateNotesEducationalQuality, validateQuizBusinessRules, ValidationError } from '../lib/ai/validation';
import { GeneratedNotes, GeneratedQuiz } from '../lib/ai/schemas';

describe('AI Validation Layer', () => {
  describe('Notes Validation', () => {
    it('passes valid notes', () => {
      const validNotes: GeneratedNotes = {
        summary: "This is a detailed summary of the document that is over 50 characters long and explains the content sufficiently well.",
        keyPoints: ["Point 1", "Point 2"],
        topics: [
          {
            title: "Topic 1",
            content: "This is a detailed explanation of Topic 1 that exceeds 10 characters.",
            sources: [{ chunkIndex: 0 }]
          }
        ]
      };
      
      expect(() => validateNotesEducationalQuality(validNotes, new Set([0]))).not.toThrow();
    });

    it('fails if summary is too short', () => {
      const invalidNotes: GeneratedNotes = {
        summary: "Short summary.",
        keyPoints: ["Point 1"],
        topics: [
          { title: "Topic 1", content: "Detailed content...", sources: [{ chunkIndex: 0 }] }
        ]
      };
      
      expect(() => validateNotesEducationalQuality(invalidNotes, new Set([0]))).toThrowError(ValidationError);
    });

    it('fails on hallucinated citations', () => {
      const hallucinatedNotes: GeneratedNotes = {
        summary: "This is a detailed summary of the document that is over 50 characters long and explains the content sufficiently well.",
        keyPoints: ["Point 1"],
        topics: [
          {
            title: "Topic 1",
            content: "This is a detailed explanation of Topic 1 that exceeds 10 characters.",
            sources: [{ chunkIndex: 99 }] // Chunk 99 is not valid
          }
        ]
      };
      
      expect(() => validateNotesEducationalQuality(hallucinatedNotes, new Set([0]))).toThrowError(ValidationError);
    });
  });

  describe('Quiz Validation', () => {
    it('passes valid quiz', () => {
      const validQuiz: GeneratedQuiz = {
        questions: [
          {
            question: "What is the capital of France?",
            options: ["Paris", "London", "Berlin", "Madrid"],
            correctAnswerIndex: 0,
            explanation: "Paris is the capital of France.",
            sources: [{ chunkIndex: 1 }]
          }
        ]
      };
      
      expect(() => validateQuizBusinessRules(validQuiz, new Set([1]))).not.toThrow();
    });

    it('fails if incorrect number of options', () => {
      const invalidQuiz: GeneratedQuiz = {
        questions: [
          {
            question: "What is the capital of France?",
            options: ["Paris", "London", "Berlin"], // Only 3 options
            correctAnswerIndex: 0,
            explanation: "Paris is the capital of France.",
            sources: [{ chunkIndex: 1 }]
          }
        ]
      };
      
      expect(() => validateQuizBusinessRules(invalidQuiz, new Set([1]))).toThrowError(ValidationError);
    });

    it('fails on duplicate options', () => {
        const invalidQuiz: GeneratedQuiz = {
          questions: [
            {
              question: "What is the capital of France?",
              options: ["Paris", "London", "Paris", "Madrid"], // Duplicate options
              correctAnswerIndex: 0,
              explanation: "Paris is the capital of France.",
              sources: [{ chunkIndex: 1 }]
            }
          ]
        };
        
        expect(() => validateQuizBusinessRules(invalidQuiz, new Set([1]))).toThrowError(ValidationError);
      });
  });
});
